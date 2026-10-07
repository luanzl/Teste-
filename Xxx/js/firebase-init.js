const firebaseConfig = {
  apiKey: "AIzaSyCSk8ySEdOx3AMKZmrS8UYPLl9IwAiGs3Q",
  authDomain: "studio-lh.firebaseapp.com",
  projectId: "studio-lh",
  storageBucket: "studio-lh.firebasestorage.app",
  messagingSenderId: "131915141002",
  appId: "1:131915141002:web:f2fe6a8c2851231201c273",
  measurementId: "G-YNCENXQDLC"
};
if (typeof firebase !== 'undefined') {
  if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(firebaseConfig);
  window.db = firebase.firestore();
}
