/* admin-login.js with Firebase */

if (localStorage.getItem('lovelink_admin_session')) {
  const session = JSON.parse(localStorage.getItem('lovelink_admin_session'));
  if (session.loggedIn) window.location.href = 'admin-dashboard.html';
}

document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('adminEmail').value.trim();
  const password = document.getElementById('adminPassword').value;
  const errorDiv = document.getElementById('loginError');

  if (!email || !password) {
    showError('Please enter email and password.');
    return;
  }

  try {
    const userCredential = await window.signInWithEmailAndPassword(window.auth, email, password);
    const userId = userCredential.user.uid;

    const adminDoc = await window.getDoc(window.doc(window.db, 'admins', userId));

    if (!adminDoc.exists()) {
      await window.auth.signOut();
      showError('Not authorized as admin.');
      return;
    }

    const admin = adminDoc.data();

    if (admin.active === false) {
      showError('Admin account deactivated.');
      await window.auth.signOut();
      return;
    }

    localStorage.setItem('lovelink_admin_session', JSON.stringify({
      loggedIn: true,
      adminId: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role
    }));

    window.location.href = 'admin-dashboard.html';

  } catch (error) {
    console.error(error);
    showError('Invalid email or password.');
  }

  function showError(msg) {
    errorDiv.textContent = msg;
    errorDiv.style.display = 'block';
    setTimeout(() => errorDiv.style.display = 'none', 4000);
  }
});