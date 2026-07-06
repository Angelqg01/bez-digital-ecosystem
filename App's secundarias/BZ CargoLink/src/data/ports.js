/**
 * Principal global container ports — real coordinates + official addresses.
 * Rendered as markers on the CargoLink network map (components/PortsMap.jsx).
 * `maps` deep-links to Google Maps for the official address.
 */
const gmaps = (address) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

export const PORTS = [
  { id: 'shanghai',  name: 'Port of Shanghai',         country: 'China',           lat: 31.2716, lng: 121.5360, address: 'No.1333 Yangshupu Road, Yangpu District, Shanghai' },
  { id: 'singapore', name: 'Port of Singapore',        country: 'Singapur',        lat: 1.2745,  lng: 103.8430, address: '7 Keppel Road, #02-00 Tanjong Pagar Complex, Singapore' },
  { id: 'ningbo',    name: 'Port of Ningbo-Zhoushan',  country: 'China',           lat: 29.8739, lng: 121.5550, address: 'No. 268, Baisha Road, Jiangbei District, Ningbo, Zhejiang' },
  { id: 'shenzhen',  name: 'Port of Shenzhen',         country: 'China',           lat: 22.5560, lng: 114.2670, address: 'Yantian Port Bureau, Main Road, Yantian District, Shenzhen' },
  { id: 'rotterdam', name: 'Port of Rotterdam',        country: 'Países Bajos',    lat: 51.9052, lng: 4.4869,   address: 'Wilhelminakade 909, 3072 AP Rotterdam' },
  { id: 'jebelali',  name: 'Port of Jebel Ali',        country: 'Dubái, EAU',      lat: 25.0100, lng: 55.0600,  address: 'Jebel Ali Free Zone, Dubai' },
  { id: 'busan',     name: 'Port of Busan',            country: 'Corea del Sur',   lat: 35.1140, lng: 129.0410, address: '122 Daego-ro, Dong-gu, Busan' },
  { id: 'la',        name: 'Port of Los Angeles',      country: 'EE. UU.',         lat: 33.7361, lng: -118.2922, address: '425 S. Palos Verdes St., San Pedro, CA 90731' },
  { id: 'antwerp',   name: 'Port of Antwerp-Bruges',   country: 'Bélgica',         lat: 51.2294, lng: 4.4050,   address: 'Zaha Hadidplein 1, 2030 Antwerpen' },
  { id: 'algeciras', name: 'Puerto de Algeciras',      country: 'España',          lat: 36.1281, lng: -5.4366,  address: 'Av. de la Hispanidad, 2, 11207 Algeciras, Cádiz', home: true },
].map((p) => ({ ...p, maps: gmaps(p.address) }));

export default PORTS;
