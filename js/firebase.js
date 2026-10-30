import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyC0l9iTDxqsiFeDY_G-p5dtECEs1WmDkLg",
    authDomain: "economarket-5d3a0.firebaseapp.com",
    projectId: "economarket-5d3a0",
    storageBucket: "economarket-5d3a0.firebasestorage.app",
    messagingSenderId: "25717515395",
    appId: "1:25717515395:web:74fc645057087419e2a7b6",
    measurementId: "G-96LQ4Q5Y4F"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const firebaseAuth = getAuth(app);
