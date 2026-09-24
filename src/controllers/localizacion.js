const VACIO = {
    street: '', number: '', neighbourhood: '', region: '', county: '',
    locality: '', administrative_area: '', postal_code: '', country: ''
};

/* Geolocaliza por IP con positionstack.
   Nota: el plan gratuito de positionstack solo soporta HTTP, no HTTPS. */
export const pedirDir = async (ip) => {
    const key = process.env.GEOCODE_KEY;
    if (!key || !ip) return { ...VACIO };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
        const res = await fetch(
            `http://api.positionstack.com/v1/reverse?access_key=${encodeURIComponent(key)}&query=${encodeURIComponent(ip)}&limit=1`,
            { headers: { 'User-Agent': 'NewManag' }, signal: controller.signal }
        );
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        return data.data?.[0] || { ...VACIO };
    } catch (err) {
        console.log('Error en geolocalización:', err.message);
        return { ...VACIO };
    } finally {
        clearTimeout(timeoutId);
    }
}
