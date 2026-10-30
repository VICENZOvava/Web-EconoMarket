import {
    getIdToken,
    signOut
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import { apiRequest } from "./api.js";
import { salvarToken } from "./auth.js";
import { firebaseAuth } from "./firebase.js";

export async function concluirLoginFirebase(usuarioFirebase, nome = "") {
    const idToken = await getIdToken(usuarioFirebase, true);

    const resultado = await apiRequest("/api/auth/firebase", {
        method: "POST",
        body: JSON.stringify({
            idToken,
            nome
        })
    });

    salvarToken(resultado.token);
    localStorage.setItem("usuario", JSON.stringify(resultado.usuario));

    // A API usa o JWT do EconoMarket; a sessão do Firebase não precisa ficar aberta no navegador.
    try {
        await signOut(firebaseAuth);
    } catch (error) {
        console.warn("Não foi possível encerrar a sessão local do Firebase.");
    }

    return resultado;
}
