// A loja para o Google (JSON-LD AutoPartsStore): UM bloco só, igual na home, no Contato e no Sobre, e o mesmo @id que o
// "seller" da página de cada peça aponta. Endereço, horário e mapa = os do Perfil da Empresa no Google (conferidos em
// 10/11/2026 no painel do perfil; o Izzat confirmou o 24 h e autorizou o endereço no site).
import { SITE } from './dados';

export const LOJA_ID = `${SITE}/#loja`;
export const LOJA_ENDERECO = {
  rua: 'Rua 504, nº 120 - Centro',
  cidade: 'Aceguá',
  uf: 'RS',
  cep: '96445-000',
};
/** O Perfil da Empresa no Google Maps (link pelo cid do perfil, não muda se o nome mudar). */
export const LOJA_MAPA = 'https://www.google.com/maps?cid=11564866247814492288';
export const LOJA_GEO = { lat: -31.8707704, lng: -54.1607653 };
/** Horário do Perfil da Empresa: 24 h de segunda a sábado; domingo fechado. */
export const LOJA_HORARIO = 'Segunda a sábado, 24 horas';

export const lojaLd = () => ({
  '@type': 'AutoPartsStore',
  '@id': LOJA_ID,
  name: 'Izzat Car Imports',
  url: `${SITE}/`,
  logo: `${SITE}/identidade/logo.png`,
  image: `${SITE}/identidade/og.jpg`,
  telephone: '+55 53 99117-0950',
  description: 'Desmanche credenciado pelo Detran-RS (CDV nº 01060). Peças originais de carros com baixa legal, nota fiscal e 90 dias de garantia. Envio para todo o Brasil.',
  address: {
    '@type': 'PostalAddress',
    streetAddress: LOJA_ENDERECO.rua,
    addressLocality: LOJA_ENDERECO.cidade,
    addressRegion: LOJA_ENDERECO.uf,
    postalCode: LOJA_ENDERECO.cep,
    addressCountry: 'BR',
  },
  geo: { '@type': 'GeoCoordinates', latitude: LOJA_GEO.lat, longitude: LOJA_GEO.lng },
  hasMap: LOJA_MAPA,
  openingHoursSpecification: [{
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    opens: '00:00',
    closes: '23:59',
  }],
  areaServed: { '@type': 'Country', name: 'Brasil' },
  currenciesAccepted: 'BRL',
  sameAs: [
    'https://www.instagram.com/cdvizzatcarimports/',
    'https://www.mercadolivre.com.br/perfil/IZZAT_CAR_IMPORTS',
    LOJA_MAPA,
  ],
});
