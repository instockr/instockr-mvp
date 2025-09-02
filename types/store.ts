export interface Store {
    id: string;
    name: string;
    store_type: string;
    address: string;
    distance: number;
    latitude: number;
    longitude: number;
    phone: string | null;
    url: string;
    source: string;
    place_id: string;
    openingHours: any[];
}