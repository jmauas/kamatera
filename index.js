import { iniciar } from "./src/server.js";

export const handler = async (event, context) => {
    try {
        const app = await iniciar();
        return app();
    } catch (e) {
        console.error(e);
        return e;
    }
};