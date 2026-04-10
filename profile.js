// ─── State ───────────────────────────────────────────────────────────────────
let currentUser = null;
let selectedPlan = '';   // empty until user explicitly chooses a plan
let uploadedPhoto = null;       // Cloudinary URL (string) after upload
let uploadedGallery = [];       // Array of Cloudinary URLs after upload
let pendingPhotoFile = null;    // Raw File object waiting to be uploaded
let pendingGalleryFiles = [];   // Raw File objects waiting to be uploaded

// ─── Cloudinary Direct Upload (No backend needed) ────────────────────────────
// 1. Go to Cloudinary Dashboard → Settings → Upload → Upload Presets
// 2. Create a preset with Signing Mode = "Unsigned", folder = "lovelink"
// 3. Fill in your cloud name and preset name below:
const CLOUDINARY_CLOUD_NAME = 'dg1ed7obk';       // e.g. 'dxyz123abc'
const CLOUDINARY_UPLOAD_PRESET = 'lovelink_preset'; // e.g. 'lovelink_unsigned'

function truncateUrl(url, maxLen = 32) {
    if (!url || url.length <= maxLen) return url;
    return url.substring(0, maxLen) + '…';
}

async function uploadToCloudinary(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    formData.append('folder', 'lovelink');

    const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
        { method: 'POST', body: formData }
    );
    if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || 'Cloudinary upload failed: ' + res.status);
    }
    const data = await res.json();
    if (!data.secure_url) throw new Error('No URL returned from Cloudinary');
    return data.secure_url;
}

function showUploadProgress(message) {
    let el = document.getElementById('uploadProgressBanner');
    if (!el) {
        el = document.createElement('div');
        el.id = 'uploadProgressBanner';
        el.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#ff4d6d,#ff758f);color:white;padding:14px 28px;border-radius:40px;font-weight:600;font-size:0.9rem;z-index:9999;box-shadow:0 8px 24px rgba(255,77,109,0.4);display:flex;align-items:center;gap:10px;max-width:90vw;text-align:center;';
        document.body.appendChild(el);
    }
    el.innerHTML = `<i class="fas fa-spinner fa-spin"></i><span>${message}</span>`;
    el.style.display = 'flex';
}

function hideUploadProgress() {
    const el = document.getElementById('uploadProgressBanner');
    if (el) el.style.display = 'none';
}

// ─── Firestore Helpers ───────────────────────────────────────────────────────
async function getAdminSettings() {
    const snap = await getDoc(doc(db, 'settings', 'admin'));
    return snap.exists() ? snap.data() : { premiumPrice: 19.99, premiumPlusPrice: 29.99 };
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await loadUserData();
    setupEventListeners();
    setupPackageSelection();
    setupGalleryUpload();
});

// ─── Load User Data from Firestore ───────────────────────────────────────────
async function loadUserData() {
    const userId = localStorage.getItem('lovelink_current_user_id');
    if (!userId) { window.location.href = 'index.html'; return; }

    // Read admin prices from Firestore
    const adminSettings = await getAdminSettings();
    const premiumPrice = (adminSettings.premiumPrice || 19.99).toFixed(2);
    const premiumPlusPrice = (adminSettings.premiumPlusPrice || 29.99).toFixed(2);
    
    const premiumPriceEl = document.querySelector('#premiumPackage .package-price');
    if (premiumPriceEl) premiumPriceEl.innerHTML = '$' + premiumPrice + '<span>/month</span>';
    const premiumPlusPriceEl = document.querySelector('#premiumPlusPackage .package-price');
    if (premiumPlusPriceEl) premiumPlusPriceEl.innerHTML = '$' + premiumPlusPrice + '<span>/month</span>';

    // Check lockout from Firestore
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) { window.location.href = 'index.html'; return; }
    
    currentUser = userDoc.data();
    const userLockout = currentUser.lockout;
    
    if (userLockout) {
        const elapsed = Date.now() - userLockout.lockedAt;
        const twelveHours = 12 * 60 * 60 * 1000;
        if (elapsed < twelveHours) {
            showLockoutScreen(userId, userLockout.lockedAt);
            return;
        } else {
            await updateDoc(doc(db, 'users', userId), { lockout: null });
            currentUser.lockout = null;
        }
    }

    document.getElementById('fullName').value = currentUser.name;
    document.getElementById('age').value = currentUser.age;
    document.getElementById('gender').value = currentUser.gender;

    const profileImg = document.getElementById('profileImage');
    if (currentUser.image) profileImg.src = currentUser.image;
    else profileImg.src = `https://ui-avatars.com/api/?background=ff4d6d&color=fff&name=${encodeURIComponent(currentUser.name)}&size=200`;

    if (currentUser.gallery && currentUser.gallery.length > 0) {
        uploadedGallery = [...currentUser.gallery];
        renderGalleryPreviews();
    }

    if (currentUser.profileCompleted) {
        document.getElementById('lookingFor').value = currentUser.lookingFor || '';
        document.getElementById('passion').value = currentUser.passion || '';
        document.getElementById('firstDate').value = currentUser.firstDate || '';
        document.getElementById('perfectPartner').value = currentUser.perfectPartner || '';
        document.getElementById('exercise').value = currentUser.exercise || 'Sometimes';
        document.getElementById('drinking').value = currentUser.drinking || 'Socially';
        document.getElementById('smoking').value = currentUser.smoking || 'Never';
        document.getElementById('diet').value = currentUser.diet || 'Anything';

        if (currentUser.dealBreakers) {
            currentUser.dealBreakers.forEach(breaker => {
                const cb = document.querySelector(`input[value="${breaker}"]`);
                if (cb) cb.checked = true;
            });
        }

        if (currentUser.isPremium) {
            selectedPlan = currentUser.subscriptionPlan || 'premium';
            document.getElementById('selectedPlanDisplay').style.display = 'block';
            document.getElementById('selectedPlanName').textContent = selectedPlan === 'premium_plus' ? 'PREMIUM+' : selectedPlan.toUpperCase();
            highlightSelectedPackage(selectedPlan);
        }

        // Inject Change Password section for returning users
        if (!document.getElementById('changePasswordSection')) {
            const form = document.getElementById('profileForm');
            const submitBtn = document.getElementById('submitProfile');
            const pwSection = document.createElement('div');
            pwSection.id = 'changePasswordSection';
            pwSection.className = 'form-section';
            pwSection.innerHTML = `
                <h3><i class="fas fa-lock"></i> Change Password</h3>
                <div class="form-group">
                    <label>Current Password</label>
                    <input type="password" id="currentPw" placeholder="Enter current password">
                </div>
                <div class="form-group">
                    <label>New Password</label>
                    <input type="password" id="newPw" placeholder="Min 6 characters">
                </div>
                <div class="form-group">
                    <label>Confirm New Password</label>
                    <input type="password" id="confirmPw" placeholder="Repeat new password">
                </div>
                <button type="button" id="changePwBtn" style="background:linear-gradient(135deg,#ff4d6d,#ff758f);color:white;border:none;padding:12px 28px;border-radius:40px;font-weight:700;cursor:pointer;font-family:inherit;font-size:0.95rem;">
                    <i class="fas fa-key"></i> Update Password
                </button>
                <div id="pwChangeMsg" style="margin-top:10px;font-size:0.85rem;display:none;"></div>
            `;
            form.insertBefore(pwSection, submitBtn);

            document.getElementById('changePwBtn').addEventListener('click', async () => {
                const current = document.getElementById('currentPw').value;
                const newPw = document.getElementById('newPw').value;
                const confirm = document.getElementById('confirmPw').value;
                const msg = document.getElementById('pwChangeMsg');

                const showMsg = (text, ok) => {
                    msg.textContent = text;
                    msg.style.color = ok ? '#2e7d32' : '#c62828';
                    msg.style.display = 'block';
                    setTimeout(() => { msg.style.display = 'none'; }, 4000);
                };

                if (!current || !newPw || !confirm) return showMsg('Please fill in all password fields.', false);
                if (current !== currentUser.password) return showMsg('Current password is incorrect.', false);
                if (newPw.length < 6) return showMsg('New password must be at least 6 characters.', false);
                if (newPw !== confirm) return showMsg('New passwords do not match.', false);

                // Save new password to Firestore
                await updateDoc(doc(db, 'users', currentUser.id), { password: newPw });
                currentUser.password = newPw;
                
                document.getElementById('currentPw').value = '';
                document.getElementById('newPw').value = '';
                document.getElementById('confirmPw').value = '';
                showMsg('✅ Password updated successfully!', true);
            });
        }
    }
}

// ─── Show Lockout Screen (Firestore version) ─────────────────────────────────
function showLockoutScreen(userId, lockedAt) {
    const twelveHours = 12 * 60 * 60 * 1000;
    const remaining = twelveHours - (Date.now() - lockedAt);

    document.body.innerHTML = `
        <div style="min-height:100vh;background:linear-gradient(135deg,#ffd6e0,#ffeef2);display:flex;align-items:center;justify-content:center;padding:20px;font-family:'Plus Jakarta Sans',sans-serif;">
            <div style="background:white;border-radius:32px;padding:48px;max-width:480px;width:100%;text-align:center;box-shadow:0 25px 50px rgba(0,0,0,0.15);">
                <div style="font-size:4rem;margin-bottom:16px;">⏳</div>
                <h2 style="font-size:1.8rem;font-weight:800;color:#1a1a2e;margin-bottom:12px;">Session Ended</h2>
                <p style="color:#666;line-height:1.6;margin-bottom:24px;">Your free 5-minute session has ended. You can come back in:</p>
                <div id="lockoutTimer" style="font-size:2.5rem;font-weight:800;color:#ff4d6d;font-variant-numeric:tabular-nums;background:#fff5f7;padding:16px 32px;border-radius:16px;margin-bottom:24px;">--:--:--</div>
                <p style="color:#888;font-size:0.9rem;margin-bottom:28px;">Or upgrade now for unlimited access</p>
                <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
                    <button id="lockoutHomeBtn" style="padding:12px 24px;border:2px solid #ff4d6d;color:#ff4d6d;border-radius:40px;background:white;font-weight:600;cursor:pointer;">Go Home</button>
                    <button id="lockoutUpgradeBtn" style="padding:12px 24px;background:#ff4d6d;color:white;border-radius:40px;border:none;font-weight:600;cursor:pointer;">Upgrade to Premium 👑</button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('lockoutHomeBtn').addEventListener('click', () => {
        localStorage.removeItem('lovelink_current_user_id');
        localStorage.removeItem('lovelink_premium');
        window.location.href = 'index.html';
    });

    document.getElementById('lockoutUpgradeBtn').addEventListener('click', () => {
        showUpgradeModal();
    });

    function updateCountdown() {
        const r = twelveHours - (Date.now() - lockedAt);
        if (r <= 0) { 
            // Clear lockout in Firestore
            updateDoc(doc(db, 'users', userId), { lockout: null }).then(() => {
                location.reload();
            });
            return; 
        }
        const h = Math.floor(r / 3600000);
        const m = Math.floor((r % 3600000) / 60000);
        const s = Math.floor((r % 60000) / 1000);
        const el = document.getElementById('lockoutTimer');
        if (el) el.textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }
    updateCountdown();
    setInterval(updateCountdown, 1000);
}

// ─── Show Upgrade Modal (Firestore prices) ───────────────────────────────────
async function showUpgradeModal() {
    const adminSettings = await getAdminSettings();
    const premiumPrice = (adminSettings.premiumPrice || 19.99).toFixed(2);
    const premiumPlusPrice = (adminSettings.premiumPlusPrice || 29.99).toFixed(2);
    
    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'upgradeModal';
    modalOverlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:10000;display:flex;align-items:center;justify-content:center;';
    
    modalOverlay.innerHTML = `
        <div style="background:white;border-radius:32px;max-width:900px;width:90%;max-height:85vh;overflow-y:auto;padding:32px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
                <h2 style="font-size:1.8rem;font-weight:800;"><i class="fas fa-crown" style="color:gold;"></i> Upgrade Your Plan</h2>
                <button id="closeUpgradeModal" style="background:none;border:none;font-size:28px;cursor:pointer;">&times;</button>
            </div>
            <p style="color:#666;margin-bottom:32px;">Unlock unlimited access and premium features</p>
            
            <div class="packages" style="display:flex;gap:20px;flex-wrap:wrap;justify-content:center;">
                <div class="package" style="flex:1;min-width:220px;background:#f8f9fa;border-radius:24px;padding:24px;text-align:center;">
                    <h3>Premium</h3>
                    <p class="price" style="font-size:2rem;font-weight:800;color:#ff4d6d;margin:16px 0;">$${premiumPrice}<span style="font-size:0.8rem;">/mo</span></p>
                    <ul style="list-style:none;margin-bottom:20px;">
                        <li style="padding:6px 0;"><i class="fas fa-infinity"></i> Unlimited access</li>
                        <li style="padding:6px 0;"><i class="fas fa-infinity"></i> Unlimited likes</li>
                        <li style="padding:6px 0;"><i class="fas fa-fire"></i> Admiration feature</li>
                        <li style="padding:6px 0;"><i class="fas fa-crown"></i> VIP badge</li>
                    </ul>
                    <button class="upgrade-subscribe-btn" data-plan="premium" style="width:100%;padding:12px;background:#ff4d6d;color:white;border:none;border-radius:40px;font-weight:600;cursor:pointer;">Upgrade Now</button>
                </div>
                <div class="package" style="flex:1;min-width:220px;background:#f8f9fa;border-radius:24px;padding:24px;text-align:center;border:2px solid #ff4d6d;position:relative;">
                    <div style="position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:#ff4d6d;color:white;padding:4px 16px;border-radius:40px;font-size:0.75rem;font-weight:600;">POPULAR</div>
                    <h3>Premium+</h3>
                    <p class="price" style="font-size:2rem;font-weight:800;color:#ff4d6d;margin:16px 0;">$${premiumPlusPrice}<span style="font-size:0.8rem;">/mo</span></p>
                    <ul style="list-style:none;margin-bottom:20px;">
                        <li style="padding:6px 0;"><i class="fas fa-infinity"></i> All Premium features</li>
                        <li style="padding:6px 0;"><i class="fas fa-chart-line"></i> Profile boost</li>
                        <li style="padding:6px 0;"><i class="fas fa-check-circle"></i> Read receipts</li>
                        <li style="padding:6px 0;"><i class="fas fa-headset"></i> Priority support</li>
                    </ul>
                    <button class="upgrade-subscribe-btn" data-plan="premium_plus" style="width:100%;padding:12px;background:#ff4d6d;color:white;border:none;border-radius:40px;font-weight:600;cursor:pointer;">Upgrade Now</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modalOverlay);
    
    document.getElementById('closeUpgradeModal').addEventListener('click', () => {
        modalOverlay.remove();
    });
    
    document.querySelectorAll('.upgrade-subscribe-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const plan = btn.dataset.plan;
            modalOverlay.remove();
            showPaymentModal(plan);
        });
    });
    
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) modalOverlay.remove();
    });
}

// ─── Payment Modal (Firestore prices) ────────────────────────────────────────
async function showPaymentModal(plan) {
    const adminSettings = await getAdminSettings();
    const premiumPrice = parseFloat(adminSettings.premiumPrice || 19.99).toFixed(2);
    const premiumPlusPrice = parseFloat(adminSettings.premiumPlusPrice || 29.99).toFixed(2);
    const planPrice = plan === 'premium' ? premiumPrice : premiumPlusPrice;
    const planName = plan === 'premium' ? 'Premium' : 'Premium+';
    
    const paymentModal = document.createElement('div');
    paymentModal.id = 'paymentModal';
    paymentModal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:10001;display:flex;align-items:center;justify-content:center;';
    
    paymentModal.innerHTML = `
        <div style="background:white;border-radius:32px;max-width:500px;width:90%;padding:32px;">
            <div style="text-align:center;margin-bottom:24px;">
                <i class="fas fa-credit-card" style="font-size:3rem;color:#ff4d6d;"></i>
                <h2 style="margin-top:12px;">Complete Payment</h2>
                <p style="color:#666;">${planName} - $${planPrice}/month</p>
            </div>
            
            <div style="margin-bottom:20px;">
                <label style="display:block;margin-bottom:8px;font-weight:600;">Card Number</label>
                <input type="text" id="cardNumber" placeholder="1234 5678 9012 3456" style="width:100%;padding:12px;border:2px solid #ffe2ec;border-radius:12px;font-family:inherit;">
            </div>
            
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
                <div>
                    <label style="display:block;margin-bottom:8px;font-weight:600;">Expiry Date</label>
                    <input type="text" id="expiryDate" placeholder="MM/YY" style="width:100%;padding:12px;border:2px solid #ffe2ec;border-radius:12px;font-family:inherit;">
                </div>
                <div>
                    <label style="display:block;margin-bottom:8px;font-weight:600;">CVV</label>
                    <input type="text" id="cvv" placeholder="123" style="width:100%;padding:12px;border:2px solid #ffe2ec;border-radius:12px;font-family:inherit;">
                </div>
            </div>
            
            <div style="margin-bottom:24px;">
                <label style="display:block;margin-bottom:8px;font-weight:600;">Cardholder Name</label>
                <input type="text" id="cardholderName" placeholder="Name on card" style="width:100%;padding:12px;border:2px solid #ffe2ec;border-radius:12px;font-family:inherit;">
            </div>
            
            <div style="display:flex;gap:12px;">
                <button id="cancelPaymentBtn" style="flex:1;padding:14px;border:2px solid #ccc;background:white;border-radius:40px;font-weight:600;cursor:pointer;">Cancel</button>
                <button id="confirmPaymentBtn" style="flex:1;padding:14px;background:#ff4d6d;color:white;border:none;border-radius:40px;font-weight:600;cursor:pointer;">Pay $${planPrice}</button>
            </div>
            
            <div id="paymentError" style="margin-top:16px;color:#c62828;font-size:0.85rem;text-align:center;display:none;"></div>
        </div>
    `;
    
    document.body.appendChild(paymentModal);
    
    document.getElementById('cancelPaymentBtn').addEventListener('click', () => {
        paymentModal.remove();
        showFreePackageConfirmation();
    });
    
    document.getElementById('confirmPaymentBtn').addEventListener('click', () => {
        processPayment(plan, paymentModal);
    });
    
    paymentModal.addEventListener('click', (e) => {
        if (e.target === paymentModal) {
            paymentModal.remove();
            showFreePackageConfirmation();
        }
    });
}

async function processPayment(plan, paymentModal) {
    const cardNumber = document.getElementById('cardNumber').value.trim();
    const expiryDate = document.getElementById('expiryDate').value.trim();
    const cvv = document.getElementById('cvv').value.trim();
    const cardholderName = document.getElementById('cardholderName').value.trim();
    
    let isValid = true;
    let errorMsg = '';
    
    if (!cardNumber || cardNumber.replace(/\s/g, '').length < 15) {
        errorMsg = 'Please enter a valid card number';
        isValid = false;
    } else if (!expiryDate || !expiryDate.match(/^(0[1-9]|1[0-2])\/(2[4-9]|[0-9]{2})$/)) {
        errorMsg = 'Please enter valid expiry date (MM/YY)';
        isValid = false;
    } else if (!cvv || cvv.length < 3) {
        errorMsg = 'Please enter valid CVV';
        isValid = false;
    } else if (!cardholderName) {
        errorMsg = 'Please enter cardholder name';
        isValid = false;
    }
    
    if (!isValid) {
        const errorDiv = document.getElementById('paymentError');
        errorDiv.textContent = errorMsg;
        errorDiv.style.display = 'block';
        return;
    }
    
    const confirmBtn = document.getElementById('confirmPaymentBtn');
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Processing...';
    
    // Fetch price before simulated delay so we can restore button label
    const adminSettings = await getAdminSettings();
    const price = plan === 'premium' ? (adminSettings.premiumPrice || 19.99) : (adminSettings.premiumPlusPrice || 29.99);

    setTimeout(() => {
        const isSuccess = Math.random() < 0.7;

        if (isSuccess) {
            paymentModal.remove();
            completePremiumUpgrade(plan);
        } else {
            const errorDiv = document.getElementById('paymentError');
            errorDiv.textContent = '❌ Payment failed. Please try again or choose free package.';
            errorDiv.style.display = 'block';
            confirmBtn.disabled = false;
            confirmBtn.textContent = `Pay $${parseFloat(price).toFixed(2)}`;
        }
    }, 1500);
}

// ─── Complete Premium Upgrade (Firestore) ────────────────────────────────────
async function completePremiumUpgrade(plan) {
    const userId = localStorage.getItem('lovelink_current_user_id');
    if (!userId) return;
    
    await updateDoc(doc(db, 'users', userId), {
        isPremium: true,
        subscriptionPlan: plan,
        premiumSince: new Date().toISOString(),
        lockout: null
    });
    
    localStorage.setItem('lovelink_premium', 'true'); // UI cache only — Firestore is source of truth
    // Lockout is cleared in Firestore above (lockout: null)
    
    // Update currentUser object
    const updatedUserDoc = await getDoc(doc(db, 'users', userId));
    currentUser = updatedUserDoc.data();
    selectedPlan = plan;
    
    alert('🎉 Payment successful! You are now a premium member. Complete your profile to continue.');
    
    highlightSelectedPackage(plan);
    document.getElementById('selectedPlanDisplay').style.display = 'block';
    document.getElementById('selectedPlanName').textContent = plan === 'premium_plus' ? 'PREMIUM+' : 'PREMIUM';
}

// ─── Free Package Confirmation (Firestore) ───────────────────────────────────
function showFreePackageConfirmation() {
    const confirmModal = document.createElement('div');
    confirmModal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:10002;display:flex;align-items:center;justify-content:center;';
    
    confirmModal.innerHTML = `
        <div style="background:white;border-radius:32px;max-width:400px;width:90%;padding:32px;text-align:center;">
            <i class="fas fa-info-circle" style="font-size:3rem;color:#ff4d6d;margin-bottom:16px;"></i>
            <h3>Choose Free Package?</h3>
            <p style="color:#666;margin:16px 0;">With the free package, you'll get 5 minutes of chat per day with a 12-hour lockout after each session.</p>
            <div style="display:flex;gap:12px;margin-top:24px;">
                <button id="cancelFreeBtn" style="flex:1;padding:12px;border:2px solid #ff4d6d;background:white;color:#ff4d6d;border-radius:40px;font-weight:600;cursor:pointer;">Go Back</button>
                <button id="confirmFreeBtn" style="flex:1;padding:12px;background:#ff4d6d;color:white;border:none;border-radius:40px;font-weight:600;cursor:pointer;">Use Free Package</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(confirmModal);
    
    document.getElementById('cancelFreeBtn').addEventListener('click', () => {
        confirmModal.remove();
        if (selectedPlan !== 'free') {
            showPaymentModal(selectedPlan);
        }
    });
    
    document.getElementById('confirmFreeBtn').addEventListener('click', async () => {
        selectedPlan = 'free';
        currentUser.isPremium = false;
        currentUser.subscriptionPlan = 'free';
        
        await setDoc(doc(db, 'users', currentUser.id), currentUser, { merge: true });
        localStorage.setItem('lovelink_premium', 'false');
        
        highlightSelectedPackage('free');
        document.getElementById('selectedPlanDisplay').style.display = 'block';
        document.getElementById('selectedPlanName').textContent = 'FREE';
        
        confirmModal.remove();
        alert('You have selected the Free package. Complete your profile to continue.');
    });
}

// ─── Profile error helper ───────────────────────────────────────────────────
function showProfileError(message) {
    const existing = document.getElementById('profileErrorBanner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.id = 'profileErrorBanner';
    banner.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #ff4d6d, #c0003a);
        color: white;
        padding: 14px 28px;
        border-radius: 40px;
        font-weight: 600;
        font-size: 0.9rem;
        z-index: 9999;
        box-shadow: 0 8px 24px rgba(255,77,109,0.4);
        display: flex;
        align-items: center;
        gap: 10px;
        max-width: 90vw;
        text-align: center;
        animation: slideDown 0.3s ease;
    `;
    banner.innerHTML = `<i class="fas fa-exclamation-circle"></i><span>${message}</span>`;
    document.body.appendChild(banner);

    if (!document.getElementById('profile-error-style')) {
        const s = document.createElement('style');
        s.id = 'profile-error-style';
        s.textContent = `@keyframes slideDown { from { opacity:0; transform:translateX(-50%) translateY(-12px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }`;
        document.head.appendChild(s);
    }

    setTimeout(() => banner.remove(), 5000);
}

// ─── Event Listeners ─────────────────────────────────────────────────────────
function setupEventListeners() {
    document.getElementById('uploadPhotoBtn').addEventListener('click', () => {
        document.getElementById('photoInput').click();
    });

    document.getElementById('photoInput').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Show local preview instantly while upload happens
        const reader = new FileReader();
        reader.onload = (ev) => { document.getElementById('profileImage').src = ev.target.result; };
        reader.readAsDataURL(file);

        // Get or create URL label
        let urlLabel = document.getElementById('profilePhotoUrlLabel');
        if (!urlLabel) {
            urlLabel = document.createElement('p');
            urlLabel.id = 'profilePhotoUrlLabel';
            urlLabel.style.cssText = 'font-size:0.75rem;margin-top:8px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500;';
            const photoUploadDiv = document.querySelector('.photo-upload');
            if (photoUploadDiv) photoUploadDiv.appendChild(urlLabel);
        }
        urlLabel.style.color = '#aaa';
        urlLabel.textContent = '⏳ Uploading to Cloudinary…';

        // Upload immediately — URL is ready before profile form submit
        showUploadProgress('Uploading profile photo…');
        try {
            const url = await uploadToCloudinary(file);
            uploadedPhoto = url;
            pendingPhotoFile = null; // already uploaded, nothing pending
            document.getElementById('profileImage').src = url;
            hideUploadProgress();
            urlLabel.style.color = '#2e7d32';
            urlLabel.title = url;
            urlLabel.textContent = '✅ ' + truncateUrl(url, 36);
        } catch (err) {
            hideUploadProgress();
            pendingPhotoFile = null;
            urlLabel.style.color = '#c62828';
            urlLabel.textContent = '❌ Upload failed — check Cloudinary config';
            showProfileError('Photo upload failed: ' + err.message);
        }
    });

    document.getElementById('profileForm').addEventListener('submit', (e) => {
        e.preventDefault();
        completeProfile();
    });
}

// ─── Gallery Functions ────────────────────────────────────────────────────────
// uploadedGallery = already-uploaded Cloudinary URLs (from existing profile)
// pendingGalleryFiles = new File objects chosen but not yet uploaded
// pendingGalleryPreviews = matching base64 previews for display

let pendingGalleryPreviews = [];

function setupGalleryUpload() {
    const addBtn = document.getElementById('addGalleryBtn');
    const galleryInput = document.getElementById('galleryInput');

    if (addBtn) {
        addBtn.addEventListener('click', () => galleryInput.click());
    }

    if (galleryInput) {
        galleryInput.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            const totalExisting = uploadedGallery.length + pendingGalleryPreviews.length;
            const remaining = 6 - totalExisting;
            const toProcess = files.slice(0, remaining);

            if (files.length > remaining) {
                alert(`You can add up to 6 gallery photos. Only ${remaining} more allowed.`);
            }
            galleryInput.value = '';

            // Upload each gallery image immediately to Cloudinary
            for (let i = 0; i < toProcess.length; i++) {
                const file = toProcess[i];

                // Show local preview as placeholder while uploading
                const previewSrc = await new Promise(res => {
                    const r = new FileReader();
                    r.onload = ev => res(ev.target.result);
                    r.readAsDataURL(file);
                });
                pendingGalleryPreviews.push(previewSrc);
                renderGalleryPreviews();

                showUploadProgress(`Uploading gallery photo ${i + 1}/${toProcess.length}…`);
                try {
                    const url = await uploadToCloudinary(file);
                    // Replace the pending preview with the real Cloudinary URL
                    const previewIdx = pendingGalleryPreviews.indexOf(previewSrc);
                    if (previewIdx !== -1) pendingGalleryPreviews.splice(previewIdx, 1);
                    uploadedGallery.push(url);
                    renderGalleryPreviews();
                } catch (err) {
                    const previewIdx = pendingGalleryPreviews.indexOf(previewSrc);
                    if (previewIdx !== -1) pendingGalleryPreviews.splice(previewIdx, 1);
                    renderGalleryPreviews();
                    showProfileError('Gallery photo ' + (i + 1) + ' failed: ' + err.message);
                }
            }
            hideUploadProgress();
        });
    }
}

function renderGalleryPreviews() {
    const grid = document.getElementById('galleryGrid');
    if (!grid) return;

    // Already-uploaded URLs
    const uploadedItems = uploadedGallery.map((url, i) => `
        <div class="gallery-thumb" style="position:relative;">
            <img src="${url}" style="width:100%;height:100px;object-fit:cover;border-radius:12px;border:2px solid #ffe2ec;">
            <p style="font-size:0.65rem;color:#aaa;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin:2px 4px 0;" title="${url}">${truncateUrl(url)}</p>
            <button type="button" onclick="removeUploadedGalleryImage(${i})"
                style="position:absolute;top:4px;right:4px;background:#ff4d6d;color:white;border:none;border-radius:50%;width:22px;height:22px;cursor:pointer;font-size:0.75rem;line-height:1;">✕</button>
        </div>
    `);

    // Pending (not-yet-uploaded) previews
    const pendingItems = pendingGalleryPreviews.map((src, i) => `
        <div class="gallery-thumb" style="position:relative;">
            <img src="${src}" style="width:100%;height:100px;object-fit:cover;border-radius:12px;border:2px dashed #ffb3c1;">
            <p style="font-size:0.65rem;color:#ffb3c1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin:2px 4px 0;">⏳ pending…</p>
            <button type="button" onclick="removePendingGalleryImage(${i})"
                style="position:absolute;top:4px;right:4px;background:#ff4d6d;color:white;border:none;border-radius:50%;width:22px;height:22px;cursor:pointer;font-size:0.75rem;line-height:1;">✕</button>
        </div>
    `);

    grid.innerHTML = [...uploadedItems, ...pendingItems].join('');

    const total = uploadedGallery.length + pendingGalleryFiles.length;
    const addBtn = document.getElementById('addGalleryBtn');
    if (addBtn) {
        addBtn.style.display = total >= 6 ? 'none' : 'flex';
        addBtn.querySelector('span').textContent = `Add Photos (${total}/6)`;
    }
}

window.removeGalleryImage = function(index) {
    uploadedGallery.splice(index, 1);
    renderGalleryPreviews();
};

window.removeUploadedGalleryImage = function(index) {
    uploadedGallery.splice(index, 1);
    renderGalleryPreviews();
};

window.removePendingGalleryImage = function(index) {
    pendingGalleryFiles.splice(index, 1);
    pendingGalleryPreviews.splice(index, 1);
    renderGalleryPreviews();
};

// ─── Package Selection (No changes) ─────────────────────────────────────────
function setupPackageSelection() {
    document.querySelectorAll('.package').forEach(packageEl => {
        packageEl.addEventListener('click', (e) => {
            if (e.target.classList.contains('package-btn')) return;
            const plan = packageEl.id === 'freePackage' ? 'free' :
                packageEl.id === 'premiumPackage' ? 'premium' : 'premium_plus';
            selectPackage(plan);
        });
    });

    document.querySelectorAll('.package-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            selectPackage(btn.dataset.plan);
        });
    });
}

function selectPackage(plan) {
    if (plan !== 'free') {
        showPaymentModal(plan);
    } else {
        selectedPlan = 'free';
        updatePackageSelectionUI(plan);
        showFreePackageConfirmation();
    }
}

function updatePackageSelectionUI(plan) {
    document.querySelectorAll('.package').forEach(p => {
        p.style.border = '';
        p.style.transform = '';
    });
    const packageId = plan === 'free' ? 'freePackage' : plan === 'premium' ? 'premiumPackage' : 'premiumPlusPackage';
    const el = document.getElementById(packageId);
    if (el) { el.style.border = '3px solid #ff4d6d'; el.style.transform = 'scale(1.02)'; }

    document.getElementById('selectedPlanDisplay').style.display = 'block';
    document.getElementById('selectedPlanName').textContent = plan === 'free' ? 'FREE' : plan === 'premium_plus' ? 'PREMIUM+' : 'PREMIUM';
}

function highlightSelectedPackage(plan) {
    const packageId = plan === 'free' ? 'freePackage' : plan === 'premium' ? 'premiumPackage' : 'premiumPlusPackage';
    const el = document.getElementById(packageId);
    if (el) el.style.border = '3px solid #ff4d6d';
}

// ─── Complete Profile (Cloudinary + Firestore) ───────────────────────────────
async function completeProfile() {
    const lookingFor = document.getElementById('lookingFor').value;
    const passion = document.getElementById('passion').value;
    const firstDate = document.getElementById('firstDate').value;
    const perfectPartner = document.getElementById('perfectPartner').value;
    const exercise = document.getElementById('exercise').value;
    const drinking = document.getElementById('drinking').value;
    const smoking = document.getElementById('smoking').value;
    const diet = document.getElementById('diet').value;

    if (!lookingFor || !passion || !firstDate || !perfectPartner) {
        showProfileError('Please fill in all required fields marked with *');
        return;
    }

    const validPlans = ['free', 'premium', 'premium_plus'];
    if (!selectedPlan || !validPlans.includes(selectedPlan)) {
        showProfileError('Please choose a subscription plan before continuing. Scroll down to "Choose Your Plan" and select one.');
        const subSection = document.querySelector('.subscription-section');
        if (subSection) subSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (subSection) {
            subSection.style.outline = '3px solid #ff4d6d';
            subSection.style.borderRadius = '16px';
            setTimeout(() => { subSection.style.outline = ''; }, 3000);
        }
        return;
    }

    const dealBreakers = [];
    document.querySelectorAll('.checkbox-group input:checked').forEach(cb => dealBreakers.push(cb.value));

    // ── All images already uploaded to Cloudinary on selection ─────────────
    // No re-upload needed here — uploadedPhoto and uploadedGallery are already URLs
    const submitBtn = document.getElementById('submitProfile');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving profile…';

    // If any pending previews remain (edge case), clear them
    pendingGalleryFiles = [];
    pendingGalleryPreviews = [];
    hideUploadProgress();

    // ── Build Firestore document ─────────────────────────────────────────────
    currentUser.lookingFor = lookingFor;
    currentUser.passion = passion;
    currentUser.firstDate = firstDate;
    currentUser.perfectPartner = perfectPartner;
    currentUser.exercise = exercise;
    currentUser.drinking = drinking;
    currentUser.smoking = smoking;
    currentUser.diet = diet;
    currentUser.dealBreakers = dealBreakers;
    currentUser.profileCompleted = true;
    currentUser.gallery = uploadedGallery; // Cloudinary URLs only

    if (selectedPlan !== 'free') {
        currentUser.isPremium = true;
        currentUser.subscriptionPlan = selectedPlan;
        localStorage.setItem('lovelink_premium', 'true');
    } else {
        currentUser.isPremium = false;
        localStorage.setItem('lovelink_premium', 'false');
    }

    // Set profile image: Cloudinary URL > existing URL > avatar fallback
    if (uploadedPhoto) {
        currentUser.image = uploadedPhoto;
    } else if (!currentUser.image || currentUser.image.startsWith('data:')) {
        currentUser.image = `https://ui-avatars.com/api/?background=ff4d6d&color=fff&name=${encodeURIComponent(currentUser.name)}&size=200`;
    }

    // All images are now Cloudinary URLs — safe to store directly in Firestore
    await setDoc(doc(db, 'users', currentUser.id), { ...currentUser }, { merge: true });

    window.location.href = 'dashboard.html';
}
