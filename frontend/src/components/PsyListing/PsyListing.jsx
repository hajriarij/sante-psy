import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Checkbox, Row, Col, TextInput, Alert, Callout, CalloutText } from '@dataesr/react-dsfr';
import { observer } from 'mobx-react';

import Page from 'components/Page/Page';
import InputSelect from 'components/InputSelect/InputSelect';

import agent from 'services/agent';
import utils from 'services/search';
import distance from 'services/distance';

import { useStore } from 'stores/';

import PsyTable from './PsyTable';
import NoResultPsyTable from './NoResultPsyTable';

import styles from './psyListing.cssmodule.scss';

const AROUND_ME = 'Autour de moi';

const geoStatusEnum = {
  UNSUPPORTED: -2,
  DENIED: -1,
  UNKNOWN: 0,
  GRANTED: 1,
};

let lastSearch;

const PsyListing = () => {
  const { commonStore: { psychologists, setPsychologists } } = useStore();
  const query = new URLSearchParams(useLocation().search);

  const [coords, setCoords] = useState();
  const [filteredPsychologists, setFilteredPsychologists] = useState([]);
  const [geoStatus, setGeoStatus] = useState(geoStatusEnum.UNKNOWN);
  const [geoLoading, setGeoLoading] = useState(false);
  const [nameFilter, setNameFilter] = useState(query.get('name') || '');
  const [languageFilter, setLanguageFilter] = useState(query.get('language') || '');
  const [addressFilter, setAddressFilter] = useState(query.get('address') || '');
  const [teleconsultation, setTeleconsultation] = useState(query.get('teleconsultation') === 'true' || false);
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (!psychologists) {
      agent.Psychologist.find().then(setPsychologists);
    }
  }, []);

  useEffect(() => {
    if (page === 0) {
      setPage(query.get('page') || 1);
    } else {
      setPage(1);
    }

    if (addressFilter === AROUND_ME) {
      checkGeolocationPermission();
    }

    logSearchInMatomo();
  }, [nameFilter, addressFilter, teleconsultation, languageFilter]);

  useEffect(() => {
    if (!psychologists) {
      setFilteredPsychologists([]);
      return;
    }

    const matchingFiltersPsychologists = psychologists.filter(psychologist => {
      if (teleconsultation && !psychologist.teleconsultation) {
        return false;
      }

      if (nameFilter && !utils.matchName(psychologist, nameFilter)
      ) {
        return false;
      }

      if (addressFilter === AROUND_ME) {
        return true;
      }

      const departementFilter = +addressFilter;
      const addressIsDepartment = departementFilter
        && (
          (departementFilter > 0 && departementFilter < 96)
          || (departementFilter > 970 && departementFilter < 977)
        );

      if (addressIsDepartment) {
        if (!utils.matchDepartment(psychologist.address, addressFilter)
          && !utils.matchDepartment(psychologist.otherAddress, addressFilter)) {
          return false;
        }
      } else if (addressFilter
        && !(
          utils.matchZipCodeOrCity(psychologist.address, addressFilter)
          || utils.matchZipCodeOrCity(psychologist.otherAddress, addressFilter)
          || utils.matchFilter(psychologist.departement, addressFilter)
          || utils.matchFilter(psychologist.region, addressFilter)
        )
      ) {
        return false;
      }

      if (languageFilter && !utils.matchFilter(psychologist.languages, languageFilter)) {
        return false;
      }

      return true;
    });

    if (coords && addressFilter === AROUND_ME) {
      setFilteredPsychologists(matchingFiltersPsychologists
        .filter(psy => psy.latitude && psy.longitude)
        .map(psy => ({
          ...psy,
          distance: distance.distanceKm(psy.latitude, psy.longitude, coords.latitude, coords.longitude),
        }))
        .sort((a, b) => a.distance - b.distance));
    } else {
      setFilteredPsychologists(matchingFiltersPsychologists);
    }
  }, [psychologists, nameFilter, addressFilter, teleconsultation, languageFilter, coords]);

  const logSearchInMatomo = () => {
    if (__MATOMO__) {
      if (lastSearch) {
        clearTimeout(lastSearch);
      }

      let search = '';
      if (nameFilter) {
        search += `name=${nameFilter};`;
      }
      if (addressFilter) {
        search += `address=${addressFilter};`;
      }
      if (teleconsultation) {
        search += `teleconsultation=${teleconsultation};`;
      }
      if (languageFilter) {
        search += `language=${languageFilter};`;
      }

      if (search) {
        lastSearch = setTimeout(
          () => {
            _paq.push(['trackEvent', 'Search', 'Psychologist', search]);
          },
          2500,
        );
      }
    }
  };

  const success = pos => {
    const { longitude, latitude } = pos.coords;
    setCoords({ longitude, latitude });
    setGeoStatus(geoStatusEnum.GRANTED);
    setGeoLoading(false);
  };

  const errors = () => {
    setGeoStatus(geoStatusEnum.DENIED);
  };

  const getGeolocation = state => {
    if (state === 'granted') {
      setGeoLoading(true);
      navigator.geolocation.getCurrentPosition(success);
    } else if (state === 'prompt') {
      setGeoLoading(true);
      navigator.geolocation.getCurrentPosition(success, errors);
    } else if (state === 'denied') {
      setGeoStatus(geoStatusEnum.DENIED);
    }
  };

  const checkGeolocationPermission = () => {
    if (!coords) {
      if (navigator.geolocation) {
        navigator.permissions
          .query({ name: 'geolocation' })
          .then(result => {
            getGeolocation(result.state);
          });
      } else {
        setGeoStatus(geoStatusEnum.UNSUPPORTED);
      }
    }
  };

  return (
    <Page
      title="Trouver un psychologue"
      description={psychologists
        ? (
          <>
            Trouver le ou la psychologue qui vous convient parmi les
            {` ${psychologists.length} `}
            référencés.
            Munissez-vous
            {' '}
            <b>obligatoirement</b>
            {' '}
            d’une lettre d’orientation de votre médecin lors du rendez-vous.
          </>
        )
        : 'Chargement de la liste des psychologues'}
      background="yellow"
      dataTestId="psyListPage"
    >
      <Callout hasInfoIcon={false}>
        <CalloutText size="md">
          En cas de séance non honorée et sans excuse valable,
          le psychologue peut se réserver le droit de refuser un étudiant.
        </CalloutText>
      </Callout>
      {psychologists && (
        <>
          <div className="fr-pb-6w fr-mt-2w">
            <Row gutters>
              <Col n="md-6 sm-12" className={styles.input}>
                <TextInput
                  className="fr-mb-1w"
                  value={nameFilter}
                  onChange={e => setNameFilter(e.target.value)}
                  label="Rechercher par nom"
                />
              </Col>
              <Col n="md-6 sm-12" className={styles.input}>
                <InputSelect
                  className="fr-mb-1w"
                  selected={addressFilter}
                  onChange={e => setAddressFilter(e)}
                  label="Rechercher par ville, code postal ou région"
                  options={[{ value: AROUND_ME, label: AROUND_ME }]}
                />
              </Col>
            </Row>
            <Row gutters>
              <Col n="md-6 sm-12" className={styles.input}>
                <TextInput
                  className="fr-mb-1w"
                  value={languageFilter}
                  onChange={e => setLanguageFilter(e.target.value)}
                  label="Rechercher par langue parlée"
                />
              </Col>
              <Col n="md-6 sm-12" className={styles.input}>
                {addressFilter === AROUND_ME && geoStatus === geoStatusEnum.DENIED && (
                  <Alert
                    className="fr-mt-1w"
                    type="error"
                    description="Veuillez autoriser la géolocalisation sur votre navigateur pour utiliser cette
                    fonctionnalité."
                  />
                )}
                {addressFilter === AROUND_ME && geoStatus === geoStatusEnum.UNSUPPORTED && (
                  <Alert
                    className="fr-mt-1w"
                    type="error"
                    description="Votre navigateur ne permet pas d'utiliser cette fonctionnalité."
                  />
                )}
              </Col>
            </Row>
            <Row gutters>
              <Col n="md-6 sm-12" className={styles.input}>
                <Checkbox
                  value="teleconsultation"
                  onChange={e => { setTeleconsultation(e.target.checked); }}
                  label="Disponible en téléconsultation"
                  defaultChecked={teleconsultation}
                />
              </Col>
            </Row>

          </div>
          <PsyTable
            page={page}
            setPage={setPage}
            psychologists={filteredPsychologists}
            nameFilter={nameFilter}
            addressFilter={addressFilter}
            languageFilter={languageFilter}
            teleconsultation={teleconsultation}
            noResult={(
              <NoResultPsyTable
                noResultAction={() => {
                  setNameFilter('');
                  setAddressFilter(AROUND_ME);
                }}
              />
            )}
            geoLoading={geoLoading}
          />
        </>
      )}
    </Page>
  );
};

export default observer(PsyListing);
