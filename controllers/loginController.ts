import { Request, Response } from 'express';

import { check } from 'express-validator';
import ejs from 'ejs';
import validation from '../utils/validation';
import dbPsychologists from '../db/psychologists';
import dbSuspensions from '../db/suspensionReasons';
import dbLoginToken from '../db/loginToken';
import dbLastConnection from '../db/lastConnections';
import date from '../utils/date';
import cookie from '../utils/cookie';
import logs from '../utils/logs';
import sendEmail from '../utils/email';
import config from '../utils/config';
import asyncHelper from '../utils/async-helper';
import CustomError from '../utils/CustomError';
import { checkXsrf } from '../middlewares/xsrfProtection';
import loginInformations from '../services/loginInformations';
import DOMPurify from '../services/sanitizer';

const emailValidators = [
  check('email')
    .isEmail()
    .withMessage('Vous devez spécifier un email valide.'),
];

async function sendLoginEmail(email: string, loginUrl: string, token: string): Promise<void> {
  try {
    const html = await ejs.renderFile('./views/emails/login.ejs', {
      loginUrlWithToken: `${loginUrl}/${encodeURIComponent(token)}`,
      appName: config.appName,
      loginUrl,
    });
    await sendEmail(email, `Connexion à ${config.appName}`, html);
    console.log(`Login email sent for ${logs.hash(email)}`);
  } catch (err) {
    console.error(err);
    throw new Error("Erreur d'envoi de mail - sendLoginEmail");
  }
}

async function sendNotYetAcceptedEmail(email: string): Promise<void> {
  try {
    const html = await ejs.renderFile('./views/emails/loginNotAcceptedYet.ejs', {
      appName: config.appName,
    });
    await sendEmail(email, `C'est trop tôt pour vous connecter à ${config.appName}`, html);
    console.log(`Not yet accepted email sent for ${logs.hash(email)}`);
  } catch (err) {
    console.error(err);
    throw new Error("Erreur d'envoi de mail - sendNotYetAcceptedEmail");
  }
}

async function saveToken(email: string, token: string): Promise<void> {
  try {
    const expiredAt = date.getDatePlusOneHour();
    await dbLoginToken.insert(token, email, expiredAt);

    console.log(`Login token created for ${logs.hash(email)}`);
  } catch (err) {
    console.error(`Erreur de sauvegarde du token : ${err}`);
    throw new Error('Erreur de sauvegarde du token');
  }
}

const deleteToken = (req: Request, res: Response): void => {
  cookie.clearJwtCookie(res);
  res.json({ });
};

const connectedUser = async (req: Request, res: Response): Promise<void> => {
  const tokenData = cookie.verifyJwt(req, res);
  if (tokenData && checkXsrf(req, tokenData.xsrfToken)) {
    const psy = await dbPsychologists.getById(tokenData.psychologist);
    const convention = await dbPsychologists.getConventionInfo(tokenData.psychologist);

    if (psy) {
      const inactiveReason = psy.active ? undefined : (await dbSuspensions.getByPsychologist(psy.dossierNumber)).reason;
      const {
        dossierNumber,
        firstNames,
        lastName,
        email,
        active,
        adeli,
        address,
        otherAddress,
        hasSeenTutorial,
        createdAt,
      } = psy;
      res.json({
        dossierNumber,
        firstNames,
        lastName,
        adeli,
        address,
        otherAddress,
        email,
        convention,
        active,
        hasSeenTutorial,
        createdAt,
        inactiveReason,
      });

      return;
    }
  }

  res.json();
};

const login = async (req: Request, res: Response): Promise<void> => {
  // Save a token that expire after config.sessionDurationHours hours if user is logged
  if (req.body.token) {
    const token = DOMPurify.sanitize(req.body.token);
    const dbToken = await dbLoginToken.getByToken(token);

    if (dbToken) {
      const psychologistData = await dbPsychologists.getAcceptedByEmail(dbToken.email);
      const xsrfToken = loginInformations.generateToken();
      cookie.createAndSetJwtCookie(res, psychologistData.dossierNumber, xsrfToken);
      console.log(`Successful authentication for ${logs.hash(dbToken.email)}`);

      dbLoginToken.delete(token);
      dbLastConnection.upsert(psychologistData.dossierNumber);

      res.json(xsrfToken);
      return;
    }

    console.log(`Invalid or expired token received : ${token.substring(0, 5)}...`);
  }

  throw new CustomError(
    'Ce lien est invalide ou expiré. Indiquez votre email ci dessous pour en avoir un nouveau.',
    401,
  );
};

/**
 * Send a email with a login link if the email is already registered
 */
const sendMail = async (req: Request, res: Response): Promise<void> => {
  validation.checkErrors(req);
  const { email } = req.body;

  console.log(`User with ${logs.hash(email)} asked for a login link`);
  const acceptedEmailExist = await dbPsychologists.getAcceptedByEmail(email);

  if (!acceptedEmailExist) {
    const notYetAcceptedEmailExist = await dbPsychologists.getNotYetAcceptedByEmail(email);
    if (notYetAcceptedEmailExist) {
      await sendNotYetAcceptedEmail(email);
      throw new CustomError(
        'Votre compte n\'est pas encore validé par nos services, veuillez rééssayer plus tard.',
        401,
      );
    }

    console.warn(`Email inconnu -ou sans suite ou refusé- qui essaye d'accéder au service : ${
      logs.hash(email)}
    `);
    throw new CustomError(
      `L'email ${email} est inconnu, ou est lié à un dossier classé sans suite ou refusé.`,
      401,
    );
  }

  const token = loginInformations.generateToken(32);
  const loginUrl = loginInformations.generateLoginUrl();
  await sendLoginEmail(email, loginUrl, token);
  await saveToken(email, token);
  res.json({
    message: `Un lien de connexion a été envoyé à l'adresse ${email
    }. Le lien est valable ${config.sessionDurationHours} heures.`,
  });
};

export default {
  emailValidators,
  connectedUser: asyncHelper(connectedUser),
  login: asyncHelper(login),
  sendMail: asyncHelper(sendMail),
  deleteToken,
};
