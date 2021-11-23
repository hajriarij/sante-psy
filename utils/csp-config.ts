import helmet from 'helmet';

export default helmet.contentSecurityPolicy({
  directives: {
    ...helmet.contentSecurityPolicy.getDefaultDirectives(),
    'script-src': [
      "'self'",
      'https://stats.data.gouv.fr/',
      // Matomo script hash
      "'sha256-4sJsjD6jok0r8RIemFeNZ1nEQfYv6qdzYIaUCTrSIhs='",
      'https://connect.facebook.net',
      'https://www.googletagmanager.com/',
    ],
    'img-src': [
      "'self'",
      'https://stats.data.gouv.fr/',
      'https://*.tile.openstreetmap.org/',
      'https://www.facebook.com/',
      'data:',
    ],
    'frame-src': ['https://stats.santepsyetudiant.beta.gouv.fr'],
    'connect-src': [
      "'self'",
      'https://nominatim.openstreetmap.org',
      'https://stats.data.gouv.fr/',
    ],
  },
});
