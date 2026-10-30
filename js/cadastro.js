import { firebaseAuth } from "./firebase.js";
import { concluirLoginFirebase } from "./firebaseSession.js";
import {
    createUserWithEmailAndPassword,
    updateProfile,
    sendEmailVerification,
    signInWithPopup,
    GoogleAuthProvider,
    signOut
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";

const cadastroForm = document.getElementById("cadastroForm");
const mensagem = document.getElementById("mensagem");
const googleCadastroButton = document.getElementById("googleCadastroButton");

function traduzirErroFirebase(error) {
    const mensagens = {
        "auth/email-already-in-use": "Esse e-mail já possui uma conta no Firebase. Entre pela tela de login.",
        "auth/invalid-email": "O e-mail informado não é válido.",
        "auth/weak-password": "A senha é muito fraca. Use pelo menos 6 caracteres.",
        "auth/operation-not-allowed": "O cadastro por e-mail/senha não está habilitado no Firebase.",
        "auth/network-request-failed": "Não foi possível conectar ao Firebase. Verifique sua internet.",
        "auth/popup-closed-by-user": "A janela do Google foi fechada antes da conclusão.",
        "auth/popup-blocked": "O navegador bloqueou a janela do Google. Permita pop-ups e tente novamente.",
        "auth/account-exists-with-different-credential": "Já existe uma conta com esse e-mail usando outro método de login. Entre pelo método original."
    };

    return mensagens[error.code] || error.message || "Não foi possível realizar o cadastro.";
}

cadastroForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const nome = document.getElementById("nome").value.trim();
    const email = document.getElementById("email").value.trim();
    const senha = document.getElementById("senha").value;
    const confirmarSenha = document.getElementById("confirmarSenha").value;

    mensagem.textContent = "";

    if (!nome) {
        mensagem.textContent = "Informe seu nome.";
        return;
    }

    if (senha !== confirmarSenha) {
        mensagem.textContent = "As senhas não coincidem.";
        return;
    }

    if (senha.length < 6) {
        mensagem.textContent = "A senha deve ter pelo menos 6 caracteres.";
        return;
    }

    try {
        mensagem.textContent = "Criando conta...";
        const credencial = await createUserWithEmailAndPassword(firebaseAuth, email, senha);
        await updateProfile(credencial.user, { displayName: nome });
        await sendEmailVerification(credencial.user);
        await signOut(firebaseAuth);

        mensagem.textContent = "Conta criada! Enviamos um link para verificar seu e-mail. Confirme-o e depois entre pela tela de login.";
        cadastroForm.reset();
    } catch (error) {
        mensagem.textContent = traduzirErroFirebase(error);
    }
});

googleCadastroButton.addEventListener("click", async () => {
    mensagem.textContent = "Conectando ao Google...";
    googleCadastroButton.disabled = true;

    try {
        const provedor = new GoogleAuthProvider();
        provedor.setCustomParameters({ prompt: "select_account" });
        const resultado = await signInWithPopup(firebaseAuth, provedor);
        await concluirLoginFirebase(resultado.user, resultado.user.displayName || "");
        mensagem.textContent = "Conta conectada com sucesso!";
        setTimeout(() => {
            window.location.href = "main.html";
        }, 500);
    } catch (error) {
        mensagem.textContent = traduzirErroFirebase(error);
    } finally {
        googleCadastroButton.disabled = false;
    }
});
