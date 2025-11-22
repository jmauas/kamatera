import { config } from 'dotenv';

config();
const key = process.env.GEOCODE_KEY;
const url = `http://api.positionstack.com/v1/reverse?access_key=${key}`;

export const pedirDir = async (lat, lng, ip) => {
    try {
        //if (!lat || !lng || lat==0 || lng==0) throw new Error('No hay coordenadas');
        //const res = await fetch(`${url}&query=${lat},${lng}`,{
        const res = await fetch(`${url}&query=${ip}&limit=1`,{
            headers: { 
                'User-Agent': 'NewManag',
            }
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        return data.data[0];    
    } catch (err) {
        console.log('--------', '--'+err);
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