/**
 * BeZhas Global Ports Library
 * Comprehensive database of major world ports for cargo manifest validation
 * Organized by region for optimized lookup and validation
 */

export interface Port {
    code: string;
    name: string;
    country: string;
    region: string;
    coordinates?: {
        lat: number;
        lng: number;
    };
}

export const GlobalPorts: Record<string, Port[]> = {
    NORTH_AMERICA: [
        { code: 'USLAX', name: 'Los Angeles', country: 'United States', region: 'North America', coordinates: { lat: 33.7405, lng: -118.2713 } },
        { code: 'USNYC', name: 'New York/New Jersey', country: 'United States', region: 'North America', coordinates: { lat: 40.6692, lng: -74.0445 } },
        { code: 'USSAV', name: 'Savannah', country: 'United States', region: 'North America', coordinates: { lat: 32.0377, lng: -81.1418 } },
        { code: 'USHOU', name: 'Houston', country: 'United States', region: 'North America', coordinates: { lat: 29.7343, lng: -95.2653 } },
        { code: 'CAVAN', name: 'Vancouver', country: 'Canada', region: 'North America', coordinates: { lat: 49.2844, lng: -123.1086 } },
        { code: 'USLGB', name: 'Long Beach', country: 'United States', region: 'North America', coordinates: { lat: 33.7552, lng: -118.1989 } },
        { code: 'USOAK', name: 'Oakland', country: 'United States', region: 'North America', coordinates: { lat: 37.8060, lng: -122.2866 } },
        { code: 'USSEA', name: 'Seattle-Tacoma', country: 'United States', region: 'North America', coordinates: { lat: 47.5707, lng: -122.3437 } },
    ],

    CENTRAL_AMERICA_CARIBBEAN: [
        { code: 'PACRQ', name: 'Colón', country: 'Panama', region: 'Central America', coordinates: { lat: 9.3582, lng: -79.9089 } },
        { code: 'PABAL', name: 'Balboa', country: 'Panama', region: 'Central America', coordinates: { lat: 8.9551, lng: -79.5659 } },
        { code: 'COCTG', name: 'Cartagena', country: 'Colombia', region: 'Central America', coordinates: { lat: 10.3910, lng: -75.5148 } },
        { code: 'CRMOI', name: 'Moín', country: 'Costa Rica', region: 'Central America', coordinates: { lat: 10.0031, lng: -83.0908 } },
        { code: 'JMKIN', name: 'Kingston', country: 'Jamaica', region: 'Caribbean', coordinates: { lat: 17.9714, lng: -76.7965 } },
        { code: 'TTPOS', name: 'Port of Spain', country: 'Trinidad and Tobago', region: 'Caribbean', coordinates: { lat: 10.6549, lng: -61.5197 } },
        { code: 'DOBSD', name: 'Caucedo', country: 'Dominican Republic', region: 'Caribbean', coordinates: { lat: 18.4247, lng: -69.6228 } },
    ],

    SOUTH_AMERICA: [
        { code: 'BRSSZ', name: 'Santos', country: 'Brazil', region: 'South America', coordinates: { lat: -23.9605, lng: -46.3340 } },
        { code: 'PECLP', name: 'El Callao', country: 'Peru', region: 'South America', coordinates: { lat: -12.0523, lng: -77.1327 } },
        { code: 'ECGYE', name: 'Guayaquil', country: 'Ecuador', region: 'South America', coordinates: { lat: -2.2740, lng: -79.9003 } },
        { code: 'CLSAI', name: 'San Antonio', country: 'Chile', region: 'South America', coordinates: { lat: -33.5833, lng: -71.6167 } },
        { code: 'ARBUE', name: 'Buenos Aires', country: 'Argentina', region: 'South America', coordinates: { lat: -34.5714, lng: -58.4554 } },
        { code: 'BRRIG', name: 'Rio Grande', country: 'Brazil', region: 'South America', coordinates: { lat: -32.0353, lng: -52.0985 } },
        { code: 'CLVAP', name: 'Valparaíso', country: 'Chile', region: 'South America', coordinates: { lat: -33.0458, lng: -71.6197 } },
        { code: 'COBAQ', name: 'Barranquilla', country: 'Colombia', region: 'South America', coordinates: { lat: 10.9685, lng: -74.7813 } },
    ],

    EUROPE: [
        { code: 'NLRTM', name: 'Rotterdam', country: 'Netherlands', region: 'Europe', coordinates: { lat: 51.9244, lng: 4.4777 } },
        { code: 'BEANR', name: 'Antwerp', country: 'Belgium', region: 'Europe', coordinates: { lat: 51.2985, lng: 4.2928 } },
        { code: 'DEHAM', name: 'Hamburg', country: 'Germany', region: 'Europe', coordinates: { lat: 53.5458, lng: 9.9664 } },
        { code: 'ESVLC', name: 'Valencia', country: 'Spain', region: 'Europe', coordinates: { lat: 39.4653, lng: -0.3551 } },
        { code: 'GRPIR', name: 'Piraeus', country: 'Greece', region: 'Europe', coordinates: { lat: 37.9412, lng: 23.6473 } },
        { code: 'ESALG', name: 'Algeciras', country: 'Spain', region: 'Europe', coordinates: { lat: 36.1333, lng: -5.4500 } },
        { code: 'PLGDN', name: 'Gdansk', country: 'Poland', region: 'Europe', coordinates: { lat: 54.4036, lng: 18.6715 } },
        { code: 'ITGOA', name: 'Genoa', country: 'Italy', region: 'Europe', coordinates: { lat: 44.4056, lng: 8.9463 } },
        { code: 'FRLEH', name: 'Le Havre', country: 'France', region: 'Europe', coordinates: { lat: 49.4932, lng: 0.1079 } },
        { code: 'GBFEL', name: 'Felixstowe', country: 'United Kingdom', region: 'Europe', coordinates: { lat: 51.9540, lng: 1.3520 } },
    ],

    AFRICA: [
        { code: 'MATNG', name: 'Tanger Med', country: 'Morocco', region: 'Africa', coordinates: { lat: 35.8689, lng: -5.5447 } },
        { code: 'ZADUR', name: 'Durban', country: 'South Africa', region: 'Africa', coordinates: { lat: -29.8587, lng: 31.0218 } },
        { code: 'GHTEM', name: 'Tema', country: 'Ghana', region: 'Africa', coordinates: { lat: 5.6667, lng: -0.0167 } },
        { code: 'EGPSD', name: 'Port Said', country: 'Egypt', region: 'Africa', coordinates: { lat: 31.2565, lng: 32.2841 } },
        { code: 'ZALAD', name: 'Cape Town', country: 'South Africa', region: 'Africa', coordinates: { lat: -33.9065, lng: 18.4245 } },
        { code: 'EGALY', name: 'Alexandria', country: 'Egypt', region: 'Africa', coordinates: { lat: 31.2, lng: 29.9167 } },
        { code: 'NGLOS', name: 'Lagos', country: 'Nigeria', region: 'Africa', coordinates: { lat: 6.4474, lng: 3.3903 } },
        { code: 'KEMBA', name: 'Mombasa', country: 'Kenya', region: 'Africa', coordinates: { lat: -4.0435, lng: 39.6682 } },
    ],

    CENTRAL_ASIA: [
        { code: 'AZBAK', name: 'Baku', country: 'Azerbaijan', region: 'Central Asia', coordinates: { lat: 40.4093, lng: 49.8671 } },
        { code: 'KZAKT', name: 'Aktau', country: 'Kazakhstan', region: 'Central Asia', coordinates: { lat: 43.6510, lng: 51.1600 } },
        { code: 'CNKHO', name: 'Khorgos (Dry Port)', country: 'China/Kazakhstan', region: 'Central Asia', coordinates: { lat: 44.2207, lng: 80.2581 } },
        { code: 'TMTKM', name: 'Turkmenbashi', country: 'Turkmenistan', region: 'Central Asia', coordinates: { lat: 40.0228, lng: 53.0046 } },
    ],

    ASIA: [
        { code: 'CNSHA', name: 'Shanghai', country: 'China', region: 'Asia', coordinates: { lat: 31.2304, lng: 121.4737 } },
        { code: 'SGSIN', name: 'Singapore', country: 'Singapore', region: 'Asia', coordinates: { lat: 1.2655, lng: 103.8565 } },
        { code: 'CNNGB', name: 'Ningbo-Zhoushan', country: 'China', region: 'Asia', coordinates: { lat: 29.8683, lng: 121.544 } },
        { code: 'CNSZX', name: 'Shenzhen', country: 'China', region: 'Asia', coordinates: { lat: 22.5431, lng: 114.0579 } },
        { code: 'CNQIN', name: 'Qingdao', country: 'China', region: 'Asia', coordinates: { lat: 36.0986, lng: 120.3719 } },
        { code: 'KRPUS', name: 'Busan', country: 'South Korea', region: 'Asia', coordinates: { lat: 35.1796, lng: 129.0756 } },
        { code: 'AEJEA', name: 'Jebel Ali', country: 'United Arab Emirates', region: 'Asia', coordinates: { lat: 24.9857, lng: 55.0272 } },
        { code: 'HKHKG', name: 'Hong Kong', country: 'Hong Kong', region: 'Asia', coordinates: { lat: 22.3193, lng: 114.1694 } },
        { code: 'JPYOK', name: 'Yokohama', country: 'Japan', region: 'Asia', coordinates: { lat: 35.4437, lng: 139.6380 } },
        { code: 'MYTPP', name: 'Port Klang', country: 'Malaysia', region: 'Asia', coordinates: { lat: 2.9989, lng: 101.3932 } },
        { code: 'THBKK', name: 'Bangkok', country: 'Thailand', region: 'Asia', coordinates: { lat: 13.7563, lng: 100.5018 } },
        { code: 'VNVUT', name: 'Vung Tau', country: 'Vietnam', region: 'Asia', coordinates: { lat: 10.3458, lng: 107.0842 } },
        { code: 'INMUN', name: 'Mumbai', country: 'India', region: 'Asia', coordinates: { lat: 19.0760, lng: 72.8777 } },
    ],

    AUSTRALIA_OCEANIA: [
        { code: 'AUMEL', name: 'Melbourne', country: 'Australia', region: 'Oceania', coordinates: { lat: -37.8136, lng: 144.9631 } },
        { code: 'AUSYD', name: 'Sydney (Port Botany)', country: 'Australia', region: 'Oceania', coordinates: { lat: -33.9601, lng: 151.2207 } },
        { code: 'AUBNE', name: 'Brisbane', country: 'Australia', region: 'Oceania', coordinates: { lat: -27.4705, lng: 153.0260 } },
        { code: 'AUPHD', name: 'Port Hedland', country: 'Australia', region: 'Oceania', coordinates: { lat: -20.3105, lng: 118.6011 } },
        { code: 'NZAKL', name: 'Auckland', country: 'New Zealand', region: 'Oceania', coordinates: { lat: -36.8485, lng: 174.7633 } },
        { code: 'NZTAU', name: 'Tauranga', country: 'New Zealand', region: 'Oceania', coordinates: { lat: -37.6878, lng: 176.1651 } },
        { code: 'AUFRE', name: 'Fremantle', country: 'Australia', region: 'Oceania', coordinates: { lat: -32.0569, lng: 115.7439 } },
    ],
};

// Helper function to get all ports as a flat array
export const getAllPorts = (): Port[] => {
    return Object.values(GlobalPorts).flat();
};

// Helper function to search ports by name or code
export const searchPorts = (query: string): Port[] => {
    const normalizedQuery = query.toLowerCase();
    return getAllPorts().filter(port =>
        port.name.toLowerCase().includes(normalizedQuery) ||
        port.code.toLowerCase().includes(normalizedQuery) ||
        port.country.toLowerCase().includes(normalizedQuery)
    );
};

// Helper function to get ports by region
export const getPortsByRegion = (region: string): Port[] => {
    return GlobalPorts[region] || [];
};

// Validate if a port code exists
export const isValidPort = (portCode: string): boolean => {
    return getAllPorts().some(port => port.code === portCode);
};

// Get port details by code
export const getPortByCode = (portCode: string): Port | undefined => {
    return getAllPorts().find(port => port.code === portCode);
};

export default GlobalPorts;
