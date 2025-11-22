import { config } from 'dotenv';

config();
const key = process.env.GEOCODE_KEY;
const url = `http://api.positionstack.com/v1/reverse?access_key=${key}`;

export const pedirDir = async (lat, lng, ip) => {
    try {
        // Timeout de 5 segundos para evitar bloqueos largos
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const res = await fetch(`${url}&query=${ip}&limit=1`,{
            headers: { 
                'User-Agent': 'NewManag',
            },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        return data.data[0];    
    } catch (err) {
        console.log('Error en geolocalización:', err.message);
        return {
            street: '',
            number: '',
            neighbourhood: '',
            region: '',
            county: '',
            locality: '',
            administrative_area: '',
            postal_code: '',
            country: ''
        }
    }
}