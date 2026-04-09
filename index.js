// DOM Elements
const navLoginBtn = document.getElementById('navLoginBtn');
const navSignupBtn = document.getElementById('navSignupBtn');
const heroSignupBtn = document.getElementById('heroSignupBtn');
const heroLearnBtn = document.getElementById('heroLearnBtn');
const ctaSignupBtn = document.getElementById('ctaSignupBtn');
const ctaLearnMore = document.getElementById('ctaLearnMore');
const modal = document.getElementById('authModal');
const closeModal = document.querySelector('.close-modal');
const modalLoginBtn = document.getElementById('modalLoginBtn');
const modalSignupBtn = document.getElementById('modalSignupBtn');

// Common countries list
const COUNTRIES = [
  "Afghanistan","Albania","Algeria","Angola","Argentina","Armenia","Australia",
  "Austria","Azerbaijan","Bangladesh","Belgium","Bolivia","Bosnia and Herzegovina",
  "Brazil","Bulgaria","Cambodia","Cameroon","Canada","Chile","China","Colombia",
  "Congo","Costa Rica","Croatia","Cuba","Czech Republic","Denmark","Dominican Republic",
  "Ecuador","Egypt","El Salvador","Estonia","Ethiopia","Finland","France","Georgia",
  "Germany","Ghana","Greece","Guatemala","Honduras","Hungary","India","Indonesia",
  "Iran","Iraq","Ireland","Israel","Italy","Jamaica","Japan","Jordan","Kazakhstan",
  "Kenya","Kuwait","Latvia","Lebanon","Libya","Lithuania","Malaysia","Mexico",
  "Morocco","Mozambique","Myanmar","Nepal","Netherlands","New Zealand","Nicaragua",
  "Nigeria","Norway","Oman","Pakistan","Panama","Paraguay","Peru","Philippines",
  "Poland","Portugal","Qatar","Romania","Russia","Saudi Arabia","Senegal","Serbia",
  "Singapore","Somalia","South Africa","South Korea","Spain","Sri Lanka","Sudan",
  "Sweden","Switzerland","Syria","Taiwan","Tanzania","Thailand","Tunisia","Turkey",
  "Uganda","Ukraine","United Arab Emirates","United Kingdom","United States",
  "Uruguay","Uzbekistan","Venezuela","Vietnam","Yemen","Zambia","Zimbabwe"
];

// Notification helper — shows styled inline alert
function showNotification(containerId, message, type = 'error') {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Remove existing notification of same type
  const existing = container.querySelector('.inline-notification');
  if (existing) existing.remove();

  const icons = { error: 'fa-circle-exclamation', success: 'fa-circle-check', warning: 'fa-triangle-exclamation' };
  const colors = {
    error:   { bg: '#fff0f2', border: '#ff4d6d', text: '#c0003a', icon: '#ff4d6d' },
    success: { bg: '#f0fff4', border: '#28a745', text: '#155724', icon: '#28a745' },
    warning: { bg: '#fffbea', border: '#f0ad00', text: '#7a5100', icon: '#f0ad00' }
  };
  const c = colors[type] || colors.error;

  const note = document.createElement('div');
  note.className = 'inline-notification';
  note.style.cssText = `
    display: flex;
    align-items: center;
    gap: 10px;
    background: ${c.bg};
    border: 1.5px solid ${c.border};
    border-radius: 14px;
    padding: 10px 16px;
    margin-top: 10px;
    font-size: 0.83rem;
    font-weight: 500;
    color: ${c.text};
    animation: notifyFadeIn 0.25s ease;
  `;
  note.innerHTML = `
    <i class="fas ${icons[type] || icons.error}" style="color:${c.icon};font-size:1rem;flex-shrink:0;"></i>
    <span>${message}</span>
    <i class="fas fa-xmark" style="margin-left:auto;cursor:pointer;opacity:0.5;font-size:0.85rem;" onclick="this.closest('.inline-notification').remove()"></i>
  `;
  container.appendChild(note);

  // Auto-remove after 5s
  setTimeout(() => note.remove(), 5000);
}

// Inject keyframe once
if (!document.getElementById('notify-style')) {
  const s = document.createElement('style');
  s.id = 'notify-style';
  s.textContent = `
    @keyframes notifyFadeIn {
      from { opacity: 0; transform: translateY(-6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(s);
}

// Smooth scroll
function smoothScrollTo(targetId) {
  const element = document.querySelector(targetId);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    document.querySelector('.features')?.scrollIntoView({ behavior: 'smooth' });
  }
}

// Build country options HTML
function buildCountryOptions() {
  return COUNTRIES.map(c => `<option value="${c}">${c}</option>`).join('');
}

// Show modal
function showAuthModal(mode = 'login') {
  const modalContainer = document.getElementById('modalAuthContainer');
  if (!modalContainer) return;

  modalContainer.innerHTML = `
    <div style="padding: 32px 32px 0;">
      <div style="text-align: center; margin-bottom: 24px;">
        <i class="fas fa-heart" style="font-size: 3rem; color: #ff4d6d;"></i>
        <h2 style="margin-top: 12px;">${mode === 'login' ? 'Welcome Back!' : 'Join LoveLink'}</h2>
        <p style="color: #6c6c7a;">${mode === 'login' ? 'Login to find your match' : 'Create your free account and start connecting'}</p>
      </div>

      <div id="modalAuthSwitch" style="display: flex; gap: 12px; margin-bottom: 24px; border-bottom: 2px solid #ffe2ec;">
        <button class="modal-tab-btn ${mode === 'login' ? 'active-tab' : ''}" data-mode="login"
          style="flex:1;background:none;border:none;padding:12px;font-weight:600;cursor:pointer;
                 color:${mode === 'login' ? '#ff4d6d' : '#888'};
                 border-bottom:${mode === 'login' ? '3px solid #ff4d6d' : 'none'};">Login</button>
        <button class="modal-tab-btn ${mode === 'signup' ? 'active-tab' : ''}" data-mode="signup"
          style="flex:1;background:none;border:none;padding:12px;font-weight:600;cursor:pointer;
                 color:${mode === 'signup' ? '#ff4d6d' : '#888'};
                 border-bottom:${mode === 'signup' ? '3px solid #ff4d6d' : 'none'};">Sign Up</button>
      </div>

      <div id="modalFormContainer">
        ${mode === 'login' ? `
          <div id="loginFormModal" style="padding-bottom:24px;">
            <div style="margin-bottom: 20px;">
              <label style="display:block;margin-bottom:8px;font-weight:500;">Email</label>
              <input type="email" id="modalLoginEmail" placeholder="your@email.com"
                style="width:100%;padding:14px;border:2px solid #ffe2ec;border-radius:60px;outline:none;font-size:0.95rem;">
            </div>
            <div style="margin-bottom: 20px;">
              <label style="display:block;margin-bottom:8px;font-weight:500;">Password</label>
              <input type="password" id="modalLoginPassword" placeholder="••••••••"
                style="width:100%;padding:14px;border:2px solid #ffe2ec;border-radius:60px;outline:none;font-size:0.95rem;">
            </div>
            <button id="modalDoLogin"
              style="width:100%;background:linear-gradient(135deg,#ff4d6d,#ff758f);color:white;border:none;
                     padding:14px;border-radius:60px;font-weight:700;cursor:pointer;font-size:1rem;">Login</button>
            <div id="loginNotifications"></div>
          </div>
        ` : `
          <div id="signupFormModal" style="padding-bottom:24px;">
            <div style="margin-bottom: 14px;">
              <input type="text" id="modalSignupName" placeholder="Full Name"
                style="width:100%;padding:14px;border:2px solid #ffe2ec;border-radius:60px;outline:none;font-size:0.95rem;">
            </div>
            <div style="margin-bottom: 14px;">
              <input type="email" id="modalSignupEmail" placeholder="Email"
                style="width:100%;padding:14px;border:2px solid #ffe2ec;border-radius:60px;outline:none;font-size:0.95rem;">
            </div>
            <div style="margin-bottom: 14px;">
              <input type="number" id="modalSignupAge" placeholder="Age (18-99)"
                style="width:100%;padding:14px;border:2px solid #ffe2ec;border-radius:60px;outline:none;font-size:0.95rem;">
            </div>
            <div style="margin-bottom: 14px;">
              <select id="modalSignupGender"
                style="width:100%;padding:14px;border:2px solid #ffe2ec;border-radius:60px;outline:none;
                       font-size:0.95rem;background:white;appearance:none;cursor:pointer;">
                <option value="">Select Gender</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Non-binary">Non-binary</option>
              </select>
            </div>
            <div style="margin-bottom: 14px;">
              <select id="modalSignupCountry"
                style="width:100%;padding:14px;border:2px solid #ffe2ec;border-radius:60px;outline:none;
                       font-size:0.95rem;background:white;appearance:none;cursor:pointer;">
                <option value="">Select Country</option>
                ${buildCountryOptions()}
              </select>
            </div>
            <div style="margin-bottom: 14px;">
              <input type="text" id="modalSignupOccupation" placeholder="Occupation"
                style="width:100%;padding:14px;border:2px solid #ffe2ec;border-radius:60px;outline:none;font-size:0.95rem;">
            </div>
            <div style="margin-bottom: 14px;">
              <textarea id="modalSignupBio" rows="2" placeholder="Tell us about yourself..."
                style="width:100%;padding:14px;border:2px solid #ffe2ec;border-radius:24px;outline:none;
                       font-size:0.95rem;resize:vertical;font-family:inherit;"></textarea>
            </div>
            <div style="margin-bottom: 20px;">
              <input type="password" id="modalSignupPassword" placeholder="Password (min 6 chars)"
                style="width:100%;padding:14px;border:2px solid #ffe2ec;border-radius:60px;outline:none;font-size:0.95rem;">
            </div>
            <button id="modalDoSignup"
              style="width:100%;background:linear-gradient(135deg,#ff4d6d,#ff758f);color:white;border:none;
                     padding:14px;border-radius:60px;font-weight:700;cursor:pointer;font-size:1rem;">
              <i class="fas fa-heart"></i> Create Account
            </button>
            <div id="signupNotifications"></div>
          </div>
        `}
      </div>
    </div>
  `;

  // Make modal content scrollable
  const modalContent = modal.querySelector('.modal-content');
  if (modalContent) {
    modalContent.style.cssText += `
      max-height: 90vh;
      overflow-y: auto;
      overflow-x: hidden;
      scrollbar-width: thin;
      scrollbar-color: #ff4d6d #ffe2ec;
    `;
  }

  modal.style.display = 'flex';

  // Tab switching
  document.querySelectorAll('.modal-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => showAuthModal(btn.getAttribute('data-mode')));
  });

  if (mode === 'login') {
    document.getElementById('modalDoLogin')?.addEventListener('click', handleModalLogin);
    // Allow Enter key
    document.getElementById('modalLoginPassword')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') handleModalLogin();
    });
  } else {
    document.getElementById('modalDoSignup')?.addEventListener('click', handleModalSignup);
  }
}

function getUsers() {
  const users = localStorage.getItem('lovelink_users');
  return users ? JSON.parse(users) : [];
}

function saveUsers(users) {
  localStorage.setItem('lovelink_users', JSON.stringify(users));
}

async function handleModalLogin() {
  const email = document.getElementById('modalLoginEmail')?.value.trim();
  const password = document.getElementById('modalLoginPassword')?.value;

  const n = document.getElementById('loginNotifications');
  if (n) n.innerHTML = '';

  if (!email || !password) {
    showNotification('loginNotifications', 'Please enter email and password.', 'error');
    return;
  }

  try {
    const userCredential = await window.signInWithEmailAndPassword(window.auth, email, password);
    const userId = userCredential.user.uid;

    // Get user data from FIRESTORE, not localStorage
    const userDoc = await window.getDoc(window.doc(window.db, 'users', userId));
    
    if (!userDoc.exists()) {
      // User exists in Auth but not in Firestore - create it
      await window.setDoc(window.doc(window.db, 'users', userId), {
        id: userId,
        email: email,
        createdAt: new Date().toISOString(),
        profileCompleted: false,
        isPremium: false
      });
      localStorage.setItem('lovelink_current_user_id', userId);
      showNotification('loginNotifications', 'Account found! Redirecting to profile...', 'success');
      setTimeout(() => window.location.href = 'profile.html', 1000);
      return;
    }

    const user = userDoc.data();

    if (user.isBanned) {
      showNotification('loginNotifications', 'Account banned. Contact support.', 'error');
      await window.auth.signOut();
      return;
    }

    if (user.isSuspended) {
      if (user.suspendedUntil && new Date(user.suspendedUntil) <= new Date()) {
        await window.updateDoc(window.doc(window.db, 'users', userId), {
          isSuspended: false,
          suspendedUntil: null
        });
      } else {
        showNotification('loginNotifications', 'Account suspended.', 'error');
        await window.auth.signOut();
        return;
      }
    }

    await window.updateDoc(window.doc(window.db, 'users', userId), {
      lastActive: new Date().toISOString(),
      isOnline: true
    });

    localStorage.setItem('lovelink_current_user_id', userId);
    showNotification('loginNotifications', 'Login successful! Redirecting...', 'success');
    setTimeout(() => {
      window.location.href = user.profileCompleted ? 'dashboard.html' : 'profile.html';
    }, 1000);
  } catch (error) {
    console.error(error);
    if (error.code === 'auth/user-not-found') {
      showNotification('loginNotifications', 'No account found with this email.', 'error');
    } else if (error.code === 'auth/wrong-password') {
      showNotification('loginNotifications', 'Incorrect password. Please try again.', 'error');
    } else if (error.code === 'auth/invalid-email') {
      showNotification('loginNotifications', 'Invalid email format.', 'error');
    } else {
      showNotification('loginNotifications', error.message, 'error');
    }
  }
}

async function handleModalSignup() {
  const name = document.getElementById('modalSignupName')?.value.trim();
  const email = document.getElementById('modalSignupEmail')?.value.trim();
  const age = parseInt(document.getElementById('modalSignupAge')?.value);
  const gender = document.getElementById('modalSignupGender')?.value;
  const country = document.getElementById('modalSignupCountry')?.value;
  const occupation = document.getElementById('modalSignupOccupation')?.value.trim();
  const bio = document.getElementById('modalSignupBio')?.value.trim();
  const password = document.getElementById('modalSignupPassword')?.value;

  const n = document.getElementById('signupNotifications');
  if (n) n.innerHTML = '';

  // Validation
  if (!name) { showNotification('signupNotifications', 'Please enter your full name.', 'error'); return; }
  if (!email) { showNotification('signupNotifications', 'Please enter your email address.', 'error'); return; }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) { showNotification('signupNotifications', 'Please enter a valid email address.', 'error'); return; }
  if (!age || isNaN(age)) { showNotification('signupNotifications', 'Please enter your age.', 'error'); return; }
  if (age < 18) { showNotification('signupNotifications', 'You must be at least 18 years old.', 'warning'); return; }
  if (age > 99) { showNotification('signupNotifications', 'Please enter a valid age (18–99).', 'error'); return; }
  if (!gender) { showNotification('signupNotifications', 'Please select your gender.', 'error'); return; }
  if (!country) { showNotification('signupNotifications', 'Please select your country.', 'error'); return; }
  if (!occupation) { showNotification('signupNotifications', 'Please enter your occupation.', 'error'); return; }
  if (!bio) { showNotification('signupNotifications', 'Please write a short bio.', 'error'); return; }
  if (!password) { showNotification('signupNotifications', 'Please create a password.', 'error'); return; }
  if (password.length < 6) { showNotification('signupNotifications', 'Password must be at least 6 characters.', 'error'); return; }

  try {
    // Create Firebase Auth user
    const userCredential = await window.createUserWithEmailAndPassword(window.auth, email, password);
    const userId = userCredential.user.uid;

    // Create user document in Firestore
    const newUser = {
      id: userId,
      name: name,
      email: email,
      age: age,
      gender: gender,
      city: country,
      country: country,
      occupation: occupation,
      bio: bio,
      isPremium: false,
      subscriptionPlan: null,
      profileCompleted: false,
      lookingFor: '',
      passion: '',
      firstDate: '',
      perfectPartner: '',
      exercise: 'Sometimes',
      drinking: 'Socially',
      smoking: 'Never',
      diet: 'Anything',
      dealBreakers: [],
      isOnline: true,
      image: `https://ui-avatars.com/api/?background=ff4d6d&color=fff&name=${encodeURIComponent(name)}&size=200`,
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString()
    };

    await window.setDoc(window.doc(window.db, 'users', userId), newUser);

    showNotification('signupNotifications', '🎉 Account created! Redirecting...', 'success');
    
    // Store userId in localStorage for page transition
    localStorage.setItem('lovelink_current_user_id', userId);
    
    // Redirect after short delay
    setTimeout(() => {
      window.location.href = 'profile.html';
    }, 1500);
    
  } catch (error) {
    console.error('Signup error:', error);
    if (error.code === 'auth/email-already-in-use') {
      showNotification('signupNotifications', 'Email already registered. Please login instead.', 'warning');
    } else if (error.code === 'auth/weak-password') {
      showNotification('signupNotifications', 'Password is too weak. Use at least 6 characters.', 'error');
    } else {
      showNotification('signupNotifications', error.message, 'error');
    }
  }
}

// Button event listeners
navLoginBtn?.addEventListener('click',  () => showAuthModal('login'));
navSignupBtn?.addEventListener('click', () => showAuthModal('signup'));
heroSignupBtn?.addEventListener('click',() => showAuthModal('signup'));
ctaSignupBtn?.addEventListener('click', () => showAuthModal('signup'));
modalLoginBtn?.addEventListener('click',() => showAuthModal('login'));
modalSignupBtn?.addEventListener('click',()=> showAuthModal('signup'));

heroLearnBtn?.addEventListener('click', () => smoothScrollTo('.features'));
ctaLearnMore?.addEventListener('click', () => smoothScrollTo('.features'));

// Close modal
closeModal?.addEventListener('click', () => { modal.style.display = 'none'; });
window.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });

// Floating bar scroll effect
window.addEventListener('scroll', () => {
  const bar = document.querySelector('.floating-bar');
  if (window.scrollY > 50) {
    bar?.style.setProperty('background', 'rgba(255,255,255,1)', 'important');
    bar?.style.setProperty('box-shadow', '0 10px 30px rgba(0,0,0,0.12)', 'important');
  } else {
    bar?.style.setProperty('background', 'rgba(255,255,255,0.98)', 'important');
    bar?.style.setProperty('box-shadow', '0 10px 30px rgba(0,0,0,0.08)', 'important');
  }
});

console.log('LoveLink Landing Page Ready — Find your match!');
// ============================================
// FOOTER LINKS MODALS - FULL FUNCTIONALITY
// ============================================

// Modal content definitions (real content)
const modalContents = {
    'help-center': {
        title: 'Help Center',
        content: `
            <div class="faq-list">
                <div class="faq-item">
                    <div class="faq-question">
                        How do I create a profile? <i class="fas fa-chevron-down"></i>
                    </div>
                    <div class="faq-answer">
                        Click "Sign Up Free" on the top bar, fill in your details (name, email, age, gender, country, occupation, and bio). 
                        After creating your account, you'll be guided to complete your profile with photos and preferences.
                    </div>
                </div>
                <div class="faq-item">
                    <div class="faq-question">
                        How does matching work? <i class="fas fa-chevron-down"></i>
                    </div>
                    <div class="faq-answer">
                        Our AI algorithm analyzes your profile, interests, and preferences to suggest compatible matches. 
                        You can like or pass on suggested profiles. When two people like each other, it's a match!
                    </div>
                </div>
                <div class="faq-item">
                    <div class="faq-question">
                        Is LoveLink free to use? <i class="fas fa-chevron-down"></i>
                    </div>
                    <div class="faq-answer">
                        Yes! Basic features are completely free. Premium members get additional benefits like unlimited likes, 
                        seeing who liked you, advanced filters, and video dates.
                    </div>
                </div>
                <div class="faq-item">
                    <div class="faq-question">
                        How do I report a user? <i class="fas fa-chevron-down"></i>
                    </div>
                    <div class="faq-answer">
                        Go to the user's profile, click the three dots menu (⋮), and select "Report". Our moderation team 
                        reviews all reports within 24 hours.
                    </div>
                </div>
                <div class="faq-item">
                    <div class="faq-question">
                        Can I delete my account? <i class="fas fa-chevron-down"></i>
                    </div>
                    <div class="faq-answer">
                        Yes. Go to Settings → Account → Delete Account. You can also temporarily hide your profile 
                        using the "Pause Account" option.
                    </div>
                </div>
            </div>
        `
    },
    'community-rules': {
        title: 'Community Rules',
        content: `
            <div class="rule-card">
                <div class="rule-icon"><i class="fas fa-user-check"></i></div>
                <div class="rule-content">
                    <h4>Be Authentic</h4>
                    <p>Use real photos and honest information about yourself. No catfishing, fake profiles, or impersonation.</p>
                </div>
            </div>
            <div class="rule-card">
                <div class="rule-icon"><i class="fas fa-heart"></i></div>
                <div class="rule-content">
                    <h4>Respect Boundaries</h4>
                    <p>No harassment, unsolicited explicit content, or aggressive behavior. Respect "no" and move on gracefully.</p>
                </div>
            </div>
            <div class="rule-card">
                <div class="rule-icon"><i class="fas fa-shield-alt"></i></div>
                <div class="rule-content">
                    <h4>Keep It Safe</h4>
                    <p>Don't share personal financial information. Report suspicious users immediately. Meet in public places for first dates.</p>
                </div>
            </div>
            <div class="rule-card">
                <div class="rule-icon"><i class="fas fa-ban"></i></div>
                <div class="rule-content">
                    <h4>No Spam or Promotions</h4>
                    <p>LoveLink is for dating, not selling products, services, or promoting social media accounts.</p>
                </div>
            </div>
            <div class="rule-card">
                <div class="rule-icon"><i class="fas fa-gavel"></i></div>
                <div class="rule-content">
                    <h4>Consequences of Violations</h4>
                    <p>Violations may result in warnings, temporary suspension, or permanent ban from the platform.</p>
                </div>
            </div>
        `
    },
    'contact-us': {
        title: 'Contact Us',
        content: `
            <form id="contactFormModal">
                <div class="contact-form-group">
                    <label>Your Name *</label>
                    <input type="text" id="contactName" placeholder="John Doe" required>
                </div>
                <div class="contact-form-group">
                    <label>Email Address *</label>
                    <input type="email" id="contactEmail" placeholder="john@example.com" required>
                </div>
                <div class="contact-form-group">
                    <label>Subject *</label>
                    <select id="contactSubject" required>
                        <option value="">Select a subject</option>
                        <option value="Account Issue">Account Issue</option>
                        <option value="Billing Question">Billing Question</option>
                        <option value="Report a User">Report a User</option>
                        <option value="Feature Request">Feature Request</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
                <div class="contact-form-group">
                    <label>Message *</label>
                    <textarea id="contactMessage" rows="4" placeholder="Please describe your issue in detail..." required></textarea>
                </div>
                <button type="submit" class="contact-submit-btn">
                    <i class="fas fa-paper-plane"></i> Send Message
                </button>
                <div id="contactFormNotification" style="margin-top: 16px; text-align: center;"></div>
            </form>
            <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #ffe2ec; text-align: center;">
                <p style="color: #6c6c7a; font-size: 0.85rem;">
                    <i class="fas fa-envelope"></i> support@lovelink.com &nbsp;|&nbsp;
                    <i class="fas fa-phone"></i> +1 601 595-0025 -LOVELINK
                </p>
                <p style="color: #6c6c7a; font-size: 0.8rem;">Response time: 24-48 hours</p>
            </div>
        `
    },
    'how-it-works': {
        title: 'How It Works',
        content: `
            <div class="step-item">
                <div class="step-number">1</div>
                <div class="step-content">
                    <h4>Create Your Profile</h4>
                    <p>Sign up for free and tell us about yourself — add photos, write a bio, share your interests and what you're looking for.</p>
                </div>
            </div>
            <div class="step-item">
                <div class="step-number">2</div>
                <div class="step-content">
                    <h4>Get Matched</h4>
                    <p>Our smart AI algorithm suggests compatible profiles based on your preferences, location, and interests.</p>
                </div>
            </div>
            <div class="step-item">
                <div class="step-number">3</div>
                <div class="step-content">
                    <h4>Connect & Chat</h4>
                    <p>Like profiles that catch your eye. When it's a mutual match, start chatting and get to know each other.</p>
                </div>
            </div>
            <div class="step-item">
                <div class="step-number">4</div>
                <div class="step-content">
                    <h4>Go on Dates</h4>
                    <p>Take it to the next level with video dates or plan an in-person meeting when you're both ready.</p>
                </div>
            </div>
            <div style="background: linear-gradient(135deg, #ff4d6d10, #ff758f10); padding: 20px; border-radius: 20px; text-align: center; margin-top: 16px;">
                <i class="fas fa-gem" style="color: #ff4d6d; font-size: 1.5rem;"></i>
                <p style="margin-top: 8px;"><strong>Pro Tip:</strong> Complete your profile 100% to get 5x more matches!</p>
            </div>
        `
    },
    'safety-tips': {
        title: 'Safety Tips',
        content: `
            <div class="safety-tip">
                <i class="fas fa-shield-alt"></i>
                <span><strong>Verify Profiles:</strong> LoveLink verifies all profiles, but always trust your instincts. Video chat before meeting.</span>
            </div>
            <div class="safety-tip">
                <i class="fas fa-coffee"></i>
                <span><strong>Meet in Public:</strong> First dates should be in busy, public locations like coffee shops or restaurants.</span>
            </div>
            <div class="safety-tip">
                <i class="fas fa-user-friends"></i>
                <span><strong>Tell a Friend:</strong> Share your date plans (location, time, and who you're meeting) with someone you trust.</span>
            </div>
            <div class="safety-tip">
                <i class="fas fa-car"></i>
                <span><strong>Arrange Your Own Transport:</strong> Don't rely on your date for rides. Keep your transportation independent.</span>
            </div>
            <div class="safety-tip">
                <i class="fas fa-dollar-sign"></i>
                <span><strong>Never Send Money:</strong> No matter the story, never send money to someone you haven't met in person.</span>
            </div>
            <div class="safety-tip">
                <i class="fas fa-flag"></i>
                <span><strong>Report Suspicious Behavior:</strong> Use our reporting system for any uncomfortable or suspicious interactions.</span>
            </div>
            <div style="background: #ff4d6d10; padding: 16px; border-radius: 20px; margin-top: 16px;">
                <p style="font-size: 0.85rem; text-align: center; margin: 0;">
                    <i class="fas fa-phone-alt"></i> <strong>Emergency?</strong> Call 911 or your local emergency number immediately.
                </p>
            </div>
        `
    },
    'success-stories': {
        title: 'Success Stories',
        content: `
            <div style="text-align: center; margin-bottom: 24px;">
                <i class="fas fa-quote-left" style="font-size: 2rem; color: #ff4d6d; opacity: 0.5;"></i>
            </div>
            <div class="testimonial-card" style="margin-bottom: 20px;">
                <p>"I joined LoveLink after a bad breakup. Within a month, I met Alex. We just got engaged last week! Thank you LoveLink for bringing us together."</p>
                <div class="testimonial-author" style="margin-top: 16px;">
                    <img src="https://randomuser.me/api/portraits/women/45.jpg" alt="Sarah">
                    <div><strong>Sarah & Alex</strong><br>Engaged, 2025</div>
                </div>
            </div>
            <div class="testimonial-card" style="margin-bottom: 20px;">
                <p>"I was skeptical about online dating, but LoveLink's matching algorithm is amazing. I found my soulmate in just 2 weeks!"</p>
                <div class="testimonial-author" style="margin-top: 16px;">
                    <img src="https://randomuser.me/api/portraits/men/42.jpg" alt="David">
                    <div><strong>David & Maria</strong><br>Together 2 years</div>
                </div>
            </div>
            <div class="testimonial-card">
                <p>"The video date feature helped us connect during lockdown. Now we live together and couldn't be happier!"</p>
                <div class="testimonial-author" style="margin-top: 16px;">
                    <img src="https://randomuser.me/api/portraits/women/28.jpg" alt="Emily">
                    <div><strong>Emily & James</strong><br>Living together</div>
                </div>
            </div>
            <div style="text-align: center; margin-top: 24px;">
                <button class="btn-outline" onclick="document.querySelector('.close-footer-modal')?.click(); document.getElementById('ctaSignupBtn')?.click();">
                    <i class="fas fa-heart"></i> Start Your Story Today
                </button>
            </div>
        `
    },
    'privacy': {
        title: 'Privacy Policy',
        content: `
            <div class="legal-section">
                <h3>Information We Collect</h3>
                <p>LoveLink collects information you provide directly, including your name, email, age, location, photos, and preferences. We also collect usage data to improve your experience.</p>
            </div>
            <div class="legal-section">
                <h3>How We Use Your Information</h3>
                <p>We use your information to match you with compatible users, personalize your experience, improve our services, and communicate with you about updates and safety.</p>
            </div>
            <div class="legal-section">
                <h3>Data Protection</h3>
                <p>We use industry-standard encryption to protect your data. Your password is hashed, and all communications are secured via SSL. We never sell your personal information to third parties.</p>
            </div>
            <div class="legal-section">
                <h3>Your Rights</h3>
                <p>You can access, update, or delete your account information at any time through settings. You may also request a copy of your data by contacting support.</p>
            </div>
            <div class="legal-section">
                <h3>Contact</h3>
                <p>For privacy questions, email privacy@lovelink.com. Last updated: January 2025.</p>
            </div>
        `
    },
    'terms': {
        title: 'Terms of Use',
        content: `
            <div class="legal-section">
                <h3>Eligibility</h3>
                <p>You must be at least 18 years old to use LoveLink. By creating an account, you confirm you meet this requirement.</p>
            </div>
            <div class="legal-section">
                <h3>Account Responsibilities</h3>
                <p>You are responsible for maintaining the confidentiality of your login credentials. You agree to provide accurate information and keep it updated.</p>
            </div>
            <div class="legal-section">
                <h3>Prohibited Conduct</h3>
                <ul>
                    <li>Harassment, abuse, or threatening behavior</li>
                    <li>Impersonating others or using fake identities</li>
                    <li>Posting explicit or inappropriate content</li>
                    <li>Commercial solicitation or spam</li>
                    <li>Attempting to bypass safety features</li>
                </ul>
            </div>
            <div class="legal-section">
                <h3>Premium Subscriptions</h3>
                <p>Premium features require a paid subscription. Subscriptions auto-renew unless cancelled at least 24 hours before renewal. Refunds are handled according to app store policies.</p>
            </div>
            <div class="legal-section">
                <h3>Account Termination</h3>
                <p>LoveLink reserves the right to suspend or terminate accounts that violate these terms. You may delete your account at any time.</p>
            </div>
        `
    },
    'cookie-policy': {
        title: 'Cookie Policy',
        content: `
            <div class="legal-section">
                <h3>What Are Cookies?</h3>
                <p>Cookies are small text files stored on your device that help us remember your preferences and improve your experience.</p>
            </div>
            <div class="legal-section">
                <h3>How We Use Cookies</h3>
                <p>We use essential cookies for authentication and security, preference cookies to remember your settings, and analytics cookies to understand how you use our platform.</p>
            </div>
            <div class="legal-section">
                <h3>Third-Party Cookies</h3>
                <p>We may use analytics providers (like Google Analytics) that set their own cookies. These help us understand user behavior and improve our service.</p>
            </div>
            <div class="legal-section">
                <h3>Managing Cookies</h3>
                <p>You can control cookies through your browser settings. However, disabling cookies may affect certain features of LoveLink.</p>
            </div>
            <div class="legal-section">
                <h3>Updates to This Policy</h3>
                <p>We may update this cookie policy occasionally. Changes will be posted here with an updated effective date.</p>
            </div>
        `
    }
};

// Create and show modal
function showFooterModal(modalId) {
    const content = modalContents[modalId];
    if (!content) return;

    // Remove any existing modals
    const existingModal = document.querySelector('.footer-modal');
    if (existingModal) existingModal.remove();

    // Create modal element
    const modalDiv = document.createElement('div');
    modalDiv.className = 'footer-modal';
    modalDiv.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2><i class="fas fa-${getModalIcon(modalId)}"></i> ${content.title}</h2>
                <span class="close-footer-modal">&times;</span>
            </div>
            <div class="modal-body">
                ${content.content}
            </div>
        </div>
    `;

    document.body.appendChild(modalDiv);
    modalDiv.style.display = 'flex';

    // Close button functionality
    const closeBtn = modalDiv.querySelector('.close-footer-modal');
    closeBtn.addEventListener('click', () => modalDiv.remove());

    // Close when clicking outside
    modalDiv.addEventListener('click', (e) => {
        if (e.target === modalDiv) modalDiv.remove();
    });

    // Initialize FAQ accordions if this is help-center
    if (modalId === 'help-center') {
        setTimeout(() => {
            document.querySelectorAll('.faq-question').forEach(question => {
                question.addEventListener('click', () => {
                    const answer = question.nextElementSibling;
                    const icon = question.querySelector('i');
                    answer.classList.toggle('active');
                    icon.style.transform = answer.classList.contains('active') ? 'rotate(180deg)' : 'rotate(0)';
                });
            });
        }, 100);
    }

    // Initialize contact form if this is contact-us
// Initialize contact form if this is contact-us
if (modalId === 'contact-us') {
    setTimeout(() => {
        const form = document.getElementById('contactFormModal');
        if (form) {
            // Remove any existing listener to prevent duplicates
            const newForm = form.cloneNode(true);
            form.parentNode.replaceChild(newForm, form);
            
            newForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const name = document.getElementById('contactName')?.value;
                const email = document.getElementById('contactEmail')?.value;
                const subject = document.getElementById('contactSubject')?.value;
                const message = document.getElementById('contactMessage')?.value;
                const notificationDiv = document.getElementById('contactFormNotification');

                if (!notificationDiv) {
                    console.error('Notification div not found');
                    return;
                }

                if (!name || !email || !subject || !message) {
                    notificationDiv.innerHTML = '<span style="color: #ff4d6d;"><i class="fas fa-exclamation-circle"></i> Please fill in all fields.</span>';
                    return;
                }
                if (!email.includes('@')) {
                    notificationDiv.innerHTML = '<span style="color: #ff4d6d;"><i class="fas fa-exclamation-circle"></i> Please enter a valid email.</span>';
                    return;
                }

                // Save contact message to localStorage for admin
                const contactMessages = JSON.parse(localStorage.getItem('lovelink_contact_messages') || '[]');
                contactMessages.push({
                    id: 'msg_' + Date.now(),
                    name: name,
                    email: email,
                    subject: subject,
                    message: message,
                    createdAt: new Date().toISOString(),
                    read: false,
                    readAt: null,
                    replied: false,
                    repliedAt: null
                });
                localStorage.setItem('lovelink_contact_messages', JSON.stringify(contactMessages));

                notificationDiv.innerHTML = '<span style="color: #28a745;"><i class="fas fa-check-circle"></i> Message sent! We\'ll respond within 24-48 hours.</span>';
                newForm.reset();
                
                setTimeout(() => {
                    notificationDiv.innerHTML = '';
                }, 5000);
            });
        }
    }, 100);
}
}

// Helper to get icon for each modal
function getModalIcon(modalId) {
    const icons = {
        'help-center': 'question-circle',
        'community-rules': 'gavel',
        'contact-us': 'envelope',
        'how-it-works': 'play-circle',
        'safety-tips': 'shield-alt',
        'success-stories': 'star',
        'privacy': 'lock',
        'terms': 'file-alt',
        'cookie-policy': 'cookie-bite'
    };
    return icons[modalId] || 'info-circle';
}

// Add click listeners to all footer links
document.querySelectorAll('.footer-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const modalId = link.getAttribute('data-modal');
        if (modalId) {
            showFooterModal(modalId);
        }
    });
});


const howItWorksBtn = document.getElementById('heroLearnBtn');
if (howItWorksBtn) {
}