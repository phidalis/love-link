/* admin-login.js with Firebase - FIXED VERSION */

// Clear any existing session on login page load
if (localStorage.getItem('lovelink_admin_session')) {
  const session = JSON.parse(localStorage.getItem('lovelink_admin_session'));
  if (session.loggedIn) window.location.href = 'admin-dashboard.html';
}

document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('adminEmail').value.trim();
  const password = document.getElementById('adminPassword').value;
  const errorDiv = document.getElementById('loginError');
  const submitBtn = document.querySelector('.login-btn');
  
  // Disable button during login
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';

  if (!email || !password) {
    showError('Please enter email and password.');
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login to Dashboard';
    return;
  }

  try {
    console.log('Attempting Firebase Auth login for:', email);
    
    // Step 1: Sign in with Firebase Auth
    const userCredential = await window.signInWithEmailAndPassword(window.auth, email, password);
    const userId = userCredential.user.uid;
    
    console.log('Auth successful, UID:', userId);

    // Step 2: Wait a moment for auth state to propagate to Firestore rules
    await new Promise(resolve => setTimeout(resolve, 500));

    // Step 3: Check if user exists in admins collection
    const adminDocRef = window.doc(window.db, 'admins', userId);
    const adminDoc = await window.getDoc(adminDocRef);

    console.log('Admin doc exists?', adminDoc.exists());

    if (!adminDoc.exists()) {
      console.error('No admin document found for UID:', userId);
      await window.auth.signOut();
      showError('Not authorized as admin. Please contact support.');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login to Dashboard';
      return;
    }

    const admin = adminDoc.data();
    console.log('Admin data:', { name: admin.name, role: admin.role, active: admin.active });

    // Step 4: Check if admin account is active
    if (admin.active === false) {
      showError('Admin account is deactivated. Please contact super admin.');
      await window.auth.signOut();
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login to Dashboard';
      return;
    }

    // Step 5: Store session
    const sessionData = {
      loggedIn: true,
      adminId: admin.id || userId,
      email: admin.email || email,
      name: admin.name || email.split('@')[0],
      role: admin.role || 'moderator'
    };
    
    localStorage.setItem('lovelink_admin_session', JSON.stringify(sessionData));
    console.log('Session saved, redirecting to dashboard...');

    // Step 6: Redirect to dashboard
    window.location.href = 'admin-dashboard.html';

  } catch (error) {
    console.error('Login error details:', error);
    
    let errorMessage = 'Invalid email or password.';
    
    // Provide more specific error messages
    switch (error.code) {
      case 'auth/user-not-found':
        errorMessage = 'No account found with this email.';
        break;
      case 'auth/wrong-password':
        errorMessage = 'Incorrect password.';
        break;
      case 'auth/too-many-requests':
        errorMessage = 'Too many failed attempts. Please try again later.';
        break;
      case 'auth/invalid-email':
        errorMessage = 'Invalid email format.';
        break;
      case 'auth/network-request-failed':
        errorMessage = 'Network error. Check your connection.';
        break;
      default:
        errorMessage = `Login failed: ${error.message}`;
    }
    
    showError(errorMessage);
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login to Dashboard';
  }

  function showError(msg) {
    errorDiv.textContent = msg;
    errorDiv.style.display = 'block';
    setTimeout(() => {
      errorDiv.style.display = 'none';
    }, 5000);
  }
});