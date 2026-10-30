import { apiRequest } from "./api.js";
import { salvarToken } from "./auth.js";
import { firebaseAuth } from "./firebase.js";
import { concluirLoginFirebase } from "./firebaseSession.js";
import {
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    sendEmailVerification,
    signOut
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";

const loginForm = document.getElementById("loginForm");
const mensagem = document.getElementById("mensagem");
const googleLoginButton = document.getElementById("googleLoginButton");

const errosQuePermitemLoginAntigo = [
    "auth/user-not-found",
    "auth/invalid-credential",
    "auth/wrong-password",
    "auth/invalid-login-credentials"
];

function traduzirErroFirebase(error) {
    const mensagens = {
        "auth/invalid-email": "O e-mail informado não é válido.",
        "auth/user-disabled": "Esta conta foi desativada.",
        "auth/too-many-requests": "Muitas tentativas. Aguarde um pouco e tente novamente.",
        "auth/network-request-failed": "Não foi possível conectar ao Firebase. Verifique sua internet.",
        "auth/popup-closed-by-user": "A janela de login do Google foi fechada antes da conclusão.",
        "auth/popup-blocked": "O navegador bloqueou a janela do Google. Permita pop-ups e tente novamente.",
        "auth/cancelled-popup-request": "Já existe uma janela de login aberta. Conclua ou feche essa janela.",
        "auth/operation-not-allowed": "Esse método de login não está habilitado no Firebase.",
        "auth/account-exists-with-different-credential": "Já existe uma conta com esse e-mail usando outro método de login. Entre pelo método original."
    };

    return mensagens[error.code] || error.message || "Não foi possível realizar o login.";
}

function redirecionarParaInicio() {
    setTimeout(() => {
        window.location.href = "main.html";
    }, 500);
}

async function loginAntigo(email, senha) {
    const resultado = await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, senha })
    });

    salvarToken(resultado.token);
    if (resultado.usuario) {
        localStorage.setItem("usuario", JSON.stringify(resultado.usuario));
    }

    mensagem.textContent = "Login realizado com a conta existente do EconoMarket!";
    redirecionarParaInicio();
}

async function finalizarLoginFirebase(usuarioFirebase) {
    if (
        usuarioFirebase.providerData.some((provider) => provider.providerId === "password") &&
        !usuarioFirebase.emailVerified
    ) {
        try {
            await sendEmailVerification(usuarioFirebase);
        } catch (error) {
            console.warn("Não foi possível reenviar o e-mail de verificação.");
        }

        try {
            await signOut(firebaseAuth);
        } catch (error) {
            console.warn("Não foi possível encerrar a sessão Firebase.");
        }

        throw new Error("Seu e-mail ainda não foi verificado. Enviamos ou reenviamos o link de verificação; confira sua caixa de entrada e o spam.");
    }

    await concluirLoginFirebase(usuarioFirebase, usuarioFirebase.displayName || "");
    mensagem.textContent = "Login realizado com sucesso!";
    redirecionarParaInicio();
}

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const senha = document.getElementById("senha").value;

    mensagem.textContent = "Entrando...";

    try {
        let credencialFirebase;

        try {
            credencialFirebase = await signInWithEmailAndPassword(firebaseAuth, email, senha);
        } catch (errorFirebase) {
            if (!errosQuePermitemLoginAntigo.includes(errorFirebase.code)) {
                throw new Error(traduzirErroFirebase(errorFirebase));
            }

            // Mantém o login local funcionando para contas antigas durante a transição.
            await loginAntigo(email, senha);
            return;
        }

        await finalizarLoginFirebase(credencialFirebase.user);
    } catch (error) {
        mensagem.textContent = error.message || "Não foi possível realizar o login.";
    }
});

googleLoginButton.addEventListener("click", async () => {
    mensagem.textContent = "Conectando ao Google...";
    googleLoginButton.disabled = true;

    try {
        const provedor = new GoogleAuthProvider();
        provedor.setCustomParameters({ prompt: "select_account" });
        const resultado = await signInWithPopup(firebaseAuth, provedor);
        await finalizarLoginFirebase(resultado.user);
    } catch (error) {
        mensagem.textContent = error.message?.startsWith("Seu e-mail")
            ? error.message
            : traduzirErroFirebase(error);
    } finally {
        googleLoginButton.disabled = false;
    }
});
