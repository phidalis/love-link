// ─── State ───────────────────────────────────────────────────────────────────
let currentUser = null;
let allUsers = [];
let timerInterval = null;
let timeRemaining = 0;
let isPremiumUser = false;
let activeChatUserId = null;
let chatPollingInterval = null;

// Firestore cache
let cachedUsers = null;
let lastFetch = 0;
const CACHE_TTL = 30000;

// ─── Firestore Helpers ───────────────────────────────────────────────────────
async function getUsers(forceRefresh = false) {
    if (!forceRefresh && cachedUsers && (Date.now() - lastFetch) < CACHE_TTL) {
        return cachedUsers;
    }
    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('profileCompleted', '==', true));
        const snapshot = await getDocs(q);
        cachedUsers = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        lastFetch = Date.now();
    } catch (err) {
        console.warn('getUsers query failed (likely Firestore rules):', err.code, err.message);
        // Fallback: at minimum load the current user so the dashboard isn't blank
        if (currentUser) {
            cachedUsers = [currentUser];
        } else {
            cachedUsers = [];
        }
    }
    return cachedUsers;
}

async function getLikes(userId) {
    // FIX: Only allow reading own likes (Firestore rule compliance)
    if (userId !== currentUser?.id) {
        console.warn('Cannot read other user\'s likes - Firestore rule violation prevented');
        return [];
    }
    const docRef = doc(db, 'likes', userId);
    const snap = await getDoc(docRef);
    return snap.exists() ? snap.data().likedUsers || [] : [];
}

async function saveLikes(userId, likedUsers) {
    await setDoc(doc(db, 'likes', userId), { likedUsers });
}

async function getReceivedLikes(userId) {
    // FIX: Only allow reading own received likes
    if (userId !== currentUser?.id) {
        console.warn('Cannot read other user\'s received likes');
        return [];
    }
    const docRef = doc(db, 'likes', userId + '_received');
    const snap = await getDoc(docRef);
    return snap.exists() ? snap.data().likedBy || [] : [];
}

async function saveReceivedLikes(userId, likedBy) {
    await setDoc(doc(db, 'likes', userId + '_received'), { likedBy });
}

async function getMatches(userId) {
    // FIX: Only allow reading own matches (Firestore rule compliance)
    if (userId !== currentUser?.id) {
        console.warn('Cannot read other user\'s matches - Firestore rule violation prevented');
        return [];
    }
    const docRef = doc(db, 'matches', userId);
    const snap = await getDoc(docRef);
    return snap.exists() ? snap.data().matchedUsers || [] : [];
}

async function saveMatches(userId, matchedUsers) {
    await setDoc(doc(db, 'matches', userId), { matchedUsers });
}

async function getAdmirations(userId) {
    // FIX: Only allow reading own admirations (Firestore rule compliance)
    if (userId !== currentUser?.id) {
        console.warn('Cannot read other user\'s admirations - Firestore rule violation prevented');
        return [];
    }
    const docRef = doc(db, 'admirations', userId);
    const snap = await getDoc(docRef);
    return snap.exists() ? snap.data().admiredUsers || [] : [];
}

async function saveAdmirations(userId, admiredUsers) {
    await setDoc(doc(db, 'admirations', userId), { admiredUsers });
}

async function getReceivedAdmirations(userId) {
    // FIX: Only allow reading own received admirations
    if (userId !== currentUser?.id) {
        console.warn('Cannot read other user\'s received admirations');
        return [];
    }
    const docRef = doc(db, 'admirations', userId + '_received');
    const snap = await getDoc(docRef);
    return snap.exists() ? snap.data().admiredBy || [] : [];
}

async function saveReceivedAdmirations(userId, admiredBy) {
    await setDoc(doc(db, 'admirations', userId + '_received'), { admiredBy });
}

async function getGuests(userId) {
    const docRef = doc(db, 'guests', userId);
    const snap = await getDoc(docRef);
    return snap.exists() ? snap.data().viewers || [] : [];
}

async function saveGuests(userId, viewers) {
    await setDoc(doc(db, 'guests', userId), { viewers });
}

async function getAdminSettings() {
    const snap = await getDoc(doc(db, 'settings', 'admin'));
    return snap.exists() ? snap.data() : { premiumPrice: 19.99, premiumPlusPrice: 29.99 };
}

function getChatKey(a, b) {
    return [a, b].sort().join('__');
}

async function getConversation(userId) {
    const convId = getChatKey(currentUser.id, userId);
    const messagesSnapshot = await getDocs(collection(db, 'conversations', convId, 'messages'));
    return messagesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

async function getAllConversationMessages(userId) {
    const convId = getChatKey(currentUser.id, userId);
    const messagesSnapshot = await getDocs(collection(db, 'conversations', convId, 'messages'));
    return messagesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

async function saveConversation(userId, newMessage) {
    const convId = getChatKey(currentUser.id, userId);
    await addDoc(collection(db, 'conversations', convId, 'messages'), newMessage);
}

// ─── Profile scroll state (Firestore) ────────────────────────────────────────
async function getSeenProfiles(containerId) {
    const userPrefs = await getDoc(doc(db, 'userPreferences', currentUser.id));
    const prefs = userPrefs.exists() ? userPrefs.data() : {};
    return prefs[`seen_${containerId}`] || [];
}

async function saveSeenProfiles(containerId, seenIds) {
    await setDoc(doc(db, 'userPreferences', currentUser.id), {
        [`seen_${containerId}`]: seenIds
    }, { merge: true });
}

async function recordSeen(containerId, userId) {
    const seen = await getSeenProfiles(containerId);
    if (!seen.includes(userId)) {
        seen.push(userId);
        await saveSeenProfiles(containerId, seen);
    }
}

async function getScrollPosition(containerId) {
    const userPrefs = await getDoc(doc(db, 'userPreferences', currentUser.id));
    const prefs = userPrefs.exists() ? userPrefs.data() : {};
    return prefs[`scroll_${containerId}`] || 0;
}

async function saveScrollPosition(containerId, pos) {
    await setDoc(doc(db, 'userPreferences', currentUser.id), {
        [`scroll_${containerId}`]: pos
    }, { merge: true });
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    const loaded = await loadUserData();
    if (!loaded) return;
    checkLockout();
    setupEventListeners();
    await loadMatches();
    await startTimerIfNeeded();
    injectProfileViewerModal();
});

// ─── Load user ────────────────────────────────────────────────────────────────
async function loadUserData() {
    const userId = localStorage.getItem('lovelink_current_user_id');
    if (!userId) { window.location.href = 'index.html'; return false; }

    allUsers = await getUsers();
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) { window.location.href = 'index.html'; return false; }
    
    currentUser = userDoc.data();

    if (currentUser.isBanned) {
        localStorage.removeItem('lovelink_current_user_id');
        localStorage.removeItem('lovelink_premium');
        alert('🚫 Your account has been permanently banned for violating our community guidelines.');
        window.location.href = 'index.html';
        return false;
    }
    if (currentUser.isSuspended) {
        if (currentUser.suspendedUntil && new Date(currentUser.suspendedUntil) <= new Date()) {
            await updateDoc(doc(db, 'users', currentUser.id), {
                isSuspended: false,
                suspendedUntil: null
            });
            currentUser.isSuspended = false;
        } else {
            localStorage.removeItem('lovelink_current_user_id');
            localStorage.removeItem('lovelink_premium');
            const until = currentUser.suspendedUntil
                ? ' until ' + new Date(currentUser.suspendedUntil).toLocaleDateString()
                : '';
            alert(`⏸️ Your account has been suspended${until}. Reason: ${currentUser.suspendReason || 'Policy violation'}.`);
            window.location.href = 'index.html';
            return false;
        }
    }

    if (!currentUser.profileCompleted) { window.location.href = 'profile.html'; return false; }

    isPremiumUser = currentUser.isPremium === true;

    document.getElementById('navUserName').textContent = currentUser.name.split(' ')[0];
    const avatar = currentUser.image || avatarUrl(currentUser);
    document.getElementById('navUserAvatar').src = avatar;
    return true;
}

function avatarUrl(user) {
    return `https://ui-avatars.com/api/?background=ff4d6d&color=fff&name=${encodeURIComponent(user.name)}&size=200`;
}

function checkLockout() {
    return;
}

// ─── Event listeners ──────────────────────────────────────────────────────────
function setupEventListeners() {
    const profileDropdown = document.getElementById('profileDropdown');
    profileDropdown.addEventListener('click', e => { e.stopPropagation(); profileDropdown.classList.toggle('active'); });
    document.addEventListener('click', () => profileDropdown.classList.remove('active'));

    document.getElementById('logoutBtn').addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('lovelink_current_user_id');
        localStorage.removeItem('lovelink_premium');
        window.location.href = 'index.html';
    });

    document.getElementById('goToProfile').addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = 'profile.html';
    });

    document.getElementById('subscriptionBtn').addEventListener('click', (e) => {
        e.preventDefault();
        openSubscriptionModal();
    });

    document.querySelectorAll('.second-nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const section = btn.dataset.section;
            if (section === 'messages') {
                openMessagesModal();
            } else {
                document.querySelectorAll('.second-nav-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                showContentSection('dating');
            }
        });
    });

    document.querySelectorAll('.side-nav-item').forEach(item => {
        item.addEventListener('click', async () => {
            const view = item.dataset.view;
            document.querySelectorAll('.side-nav-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            await showContentSection(view);
        });
    });

    document.querySelectorAll('.close-modal').forEach(close => {
        close.addEventListener('click', () => {
            document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
            if (chatPollingInterval) clearInterval(chatPollingInterval);
        });
    });

    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
            if (chatPollingInterval) clearInterval(chatPollingInterval);
        }
    });

    document.querySelectorAll('.subscribe-btn').forEach(btn => {
        btn.addEventListener('click', () => subscribe(btn.dataset.plan));
    });
}

// ─── Section routing ──────────────────────────────────────────────────────────
async function showContentSection(view) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));

    const map = {
        'dating': 'datingSection',
        'new-users': 'newUsersSection',
        'vip-users': 'vipUsersSection',
        'about': 'aboutSection',
        'messages-side': 'messagesSideSection',
        'likes': 'likesSection',
        'mutually': 'mutuallySection',
        'guests': 'guestsSection',
    };

    if (view === 'profile') { window.location.href = 'profile.html'; return; }

    if (view === 'new-users') await loadNewUsers();
    if (view === 'vip-users') await loadVIPUsers();
    if (view === 'messages-side') await loadMessagesSideView();
    if (view === 'likes') await loadLikes();
    if (view === 'mutually') await loadMutually();
    if (view === 'guests') await loadGuests();

    const target = document.getElementById(map[view] || 'datingSection');
    if (target) target.classList.add('active');
}

// NEW HELPER FUNCTION: Check if two users have mutual admiration without reading other user's data
async function checkMutualStatus(userId) {
    const mutualLikeRef = doc(db, 'mutual_likes', `${currentUser.id}_${userId}`);
    const mutualLikeSnap = await getDoc(mutualLikeRef);
    
    const mutualAdmireRef = doc(db, 'mutual_admirations', `${currentUser.id}_${userId}`);
    const mutualAdmireSnap = await getDoc(mutualAdmireRef);
    
    return {
        isMutualLike: mutualLikeSnap.exists() && mutualLikeSnap.data().likedByUser2 === true,
        isMutualAdmire: mutualAdmireSnap.exists() && mutualAdmireSnap.data().admiredByUser2 === true
    };
}

// ─── Card rendering ───────────────────────────────────────────────────────────
async function loadMatches() {
    const oppositeGender = currentUser.gender === 'Male' ? 'Female' : (currentUser.gender === 'Female' ? 'Male' : null);
    let matches = allUsers.filter(u => u.id !== currentUser.id && u.profileCompleted !== false);
    if (oppositeGender) matches = matches.filter(u => u.gender === oppositeGender);

    const myCountry = (currentUser.country || currentUser.city || '').toLowerCase().trim();
    if (myCountry) {
        const sameCountry = matches.filter(u => (u.country || u.city || '').toLowerCase().trim() === myCountry);
        const otherCountry = matches.filter(u => (u.country || u.city || '').toLowerCase().trim() !== myCountry);
        matches = [...sameCountry, ...otherCountry];
    }

    await renderCards('datingCardsContainer', matches);
}

async function loadNewUsers() {
    const oppositeGender = currentUser.gender === 'Male' ? 'Female' : 'Male';
    let newUsers = allUsers.filter(u => u.id !== currentUser.id && u.gender === oppositeGender && u.profileCompleted !== false)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 20);

    const myCountry = (currentUser.country || currentUser.city || '').toLowerCase().trim();
    if (myCountry) {
        const same = newUsers.filter(u => (u.country || u.city || '').toLowerCase().trim() === myCountry);
        const other = newUsers.filter(u => (u.country || u.city || '').toLowerCase().trim() !== myCountry);
        newUsers = [...same, ...other];
    }

    await renderCards('newUsersContainer', newUsers);
}

async function loadVIPUsers() {
    const oppositeGender = currentUser.gender === 'Male' ? 'Female' : 'Male';
    let vipUsers = allUsers.filter(u => u.id !== currentUser.id && u.gender === oppositeGender && u.isPremium === true);

    const myCountry = (currentUser.country || currentUser.city || '').toLowerCase().trim();
    if (myCountry) {
        const same = vipUsers.filter(u => (u.country || u.city || '').toLowerCase().trim() === myCountry);
        const other = vipUsers.filter(u => (u.country || u.city || '').toLowerCase().trim() !== myCountry);
        vipUsers = [...same, ...other];
    }

    await renderCards('vipUsersContainer', vipUsers);
}

async function renderCards(containerId, users) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (users.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-heart-broken"></i><p>No matches found yet. Check back soon!</p></div>`;
        return;
    }

    let seen = await getSeenProfiles(containerId);
    const unseenUsers = users.filter(u => !seen.includes(u.id));
    const seenUsers = users.filter(u => seen.includes(u.id));

    let orderedUsers;
    if (unseenUsers.length > 0) {
        orderedUsers = [...unseenUsers, ...seenUsers];
    } else {
        await saveSeenProfiles(containerId, []);
        orderedUsers = [...users];
    }

    const userLikes = await getLikes(currentUser.id);
    const userAdmirations = await getAdmirations(currentUser.id);
    const userMatches = await getMatches(currentUser.id);
    const myCountry = (currentUser.country || currentUser.city || '').toLowerCase().trim();

    container.innerHTML = orderedUsers.map(user => {
        const liked = userLikes.includes(user.id);
        const admired = userAdmirations.includes(user.id);
        const isMatch = userMatches.includes(user.id);
        const img = user.image || avatarUrl(user);
        const userCountry = (user.country || user.city || '').toLowerCase().trim();
        const isLocal = myCountry && userCountry === myCountry;

        return `
        <div class="product-card" data-user-id="${user.id}">
            <div class="card-image" onclick="viewProfileFullscreen('${user.id}')">
                <img src="${img}" alt="${user.name}" loading="lazy">
                <div class="online-status ${user.isOnline ? '' : 'offline'}"></div>
                ${user.isPremium ? '<div class="vip-badge"><i class="fas fa-crown"></i> VIP</div>' : ''}
                ${isMatch ? '<div class="match-badge"><i class="fas fa-fire"></i> Admiration</div>' : ''}
                ${isLocal ? '<div class="local-badge"><i class="fas fa-map-marker-alt"></i> Near You</div>' : ''}
            </div>
            <div class="card-info">
                <h3>${user.name}, ${user.age}</h3>
                <div class="card-description">
                    <i class="fas fa-map-marker-alt" style="color:#ff4d6d;font-size:0.75rem;"></i> ${user.city || 'Unknown'}
                    &nbsp;•&nbsp; ${user.lookingFor || 'Relationship'}
                </div>
            </div>
            <div class="card-footer">
                <div class="card-footer-left">
                    <button class="camera-icon" title="View Profile" onclick="viewProfileFullscreen('${user.id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="like-icon ${liked ? 'liked' : ''}" title="Like" onclick="handleLike('${user.id}', this)">
                        <i class="fas fa-heart"></i>
                    </button>
                    <button class="admire-icon ${admired ? 'admired' : ''}" title="Admire" onclick="handleAdmire('${user.id}', this)">
                        <i class="fas fa-star"></i>
                    </button>
                </div>
                ${isMatch ? `<button class="msg-quick-btn" onclick="openChat('${user.id}')"><i class="fas fa-comment"></i></button>` : ''}
            </div>
        </div>`;
    }).join('');

    const savedScroll = await getScrollPosition(containerId);
    if (savedScroll > 0) {
        requestAnimationFrame(() => { container.scrollLeft = savedScroll; });
    }

    container.addEventListener('scroll', async () => {
        await saveScrollPosition(containerId, container.scrollLeft);
    }, { passive: true });

    const observer = new IntersectionObserver(async (entries) => {
        for (const entry of entries) {
            if (entry.isIntersecting) {
                const userId = entry.target.dataset.userId;
                if (userId) await recordSeen(containerId, userId);
            }
        }
    }, { root: container, threshold: 0.5 });

    container.querySelectorAll('.product-card[data-user-id]').forEach(card => observer.observe(card));
}

// ─── Like / Admire logic ──────────────────────────────────────────────────────
async function handleLike(userId, btn) {
    if (!isPremiumUser && !(await checkFreeUserLikeLimit())) {
        showToast('Free users can send 5 likes/day. Upgrade for unlimited! 💎', 'warning');
        openSubscriptionModal();
        return;
    }

    const userLikes = await getLikes(currentUser.id);
    const alreadyLiked = userLikes.includes(userId);
    
    if (alreadyLiked) {
        await saveLikes(currentUser.id, userLikes.filter(id => id !== userId));
        const receivedLikes = await getReceivedLikes(userId);
        await saveReceivedLikes(userId, receivedLikes.filter(id => id !== currentUser.id));
        if (btn) { btn.classList.remove('liked'); btn.querySelector('i').style.animation = ''; }
        return;
    }

    await saveLikes(currentUser.id, [...userLikes, userId]);
    
    const receivedLikes = await getReceivedLikes(userId);
    if (!receivedLikes.includes(currentUser.id)) {
        await saveReceivedLikes(userId, [...receivedLikes, currentUser.id]);
    }

    if (btn) {
        btn.classList.add('liked');
        btn.querySelector('i').style.animation = 'heartPop 0.4s ease';
    }

    // FIX: Check for mutual match using mutual_likes collection instead of reading other user's likes
    const mutualRef = doc(db, 'mutual_likes', `${userId}_${currentUser.id}`);
    const mutualSnap = await getDoc(mutualRef);
    
    if (mutualSnap.exists()) {
        // They already liked you, create mutual admiration
        await createMutualAdmiration(userId);
        const otherUser = allUsers.find(u => u.id === userId);
        showMatchOverlay(otherUser);
    } else {
        // Create a mutual_likes document for when they like you back
        await setDoc(mutualRef, {
            user1: userId,
            user2: currentUser.id,
            createdAt: new Date().toISOString(),
            likedByUser1: true,
            likedByUser2: false
        });
        showToast('❤️ Like sent!');
    }
}

async function handleAdmire(userId, btn) {
    if (!isPremiumUser) {
        showToast('✨ Admiration is a Premium feature!', 'warning');
        openSubscriptionModal();
        return;
    }

    const userAdmirations = await getAdmirations(currentUser.id);
    
    if (userAdmirations.includes(userId)) {
        showToast('You already admired this person ⭐');
        return;
    }

    await saveAdmirations(currentUser.id, [...userAdmirations, userId]);
    
    const receivedAdmirations = await getReceivedAdmirations(userId);
    if (!receivedAdmirations.includes(currentUser.id)) {
        await saveReceivedAdmirations(userId, [...receivedAdmirations, currentUser.id]);
    }

    if (btn) btn.classList.add('admired');

    // FIX: Check for mutual admiration using mutual_admiration collection
    const mutualRef = doc(db, 'mutual_admirations', `${userId}_${currentUser.id}`);
    const mutualSnap = await getDoc(mutualRef);
    
    if (mutualSnap.exists()) {
        await createMutualAdmiration(userId);
        const otherUser = allUsers.find(u => u.id === userId);
        showMatchOverlay(otherUser, true);
    } else {
        await setDoc(mutualRef, {
            user1: userId,
            user2: currentUser.id,
            createdAt: new Date().toISOString(),
            admiredByUser1: true,
            admiredByUser2: false
        });
        showToast('⭐ Admiration sent! They\'ll be notified!');
    }
}

async function createMutualAdmiration(userId) {
    const userMatches = await getMatches(currentUser.id);
    const theirMatches = await getMatches(userId);
    
    let changed = false;
    
    if (!userMatches.includes(userId)) {
        await saveMatches(currentUser.id, [...userMatches, userId]);
        changed = true;
    }
    if (!theirMatches.includes(currentUser.id)) {
        await saveMatches(userId, [...theirMatches, currentUser.id]);
        changed = true;
    }
    
    if (changed) {
        allUsers = await getUsers(true);
        return true;
    }
    return false;
}

function closeAllModalsAndOverlays() {
    const matchOverlay = document.getElementById('matchOverlay');
    if (matchOverlay) matchOverlay.style.display = 'none';
    
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
    
    if (chatPollingInterval) {
        clearInterval(chatPollingInterval);
        chatPollingInterval = null;
    }
}

window.closeAllModalsAndOverlays = closeAllModalsAndOverlays;

async function checkFreeUserLikeLimit() {
    const today = new Date().toDateString();
    const userDoc = await getDoc(doc(db, 'users', currentUser.id));
    const userData = userDoc.data();
    const dailyLikes = userData.dailyLikes || {};
    
    if (dailyLikes.date !== today) {
        await updateDoc(doc(db, 'users', currentUser.id), {
            'dailyLikes.date': today,
            'dailyLikes.count': 0
        });
        return true;
    }
    
    if (dailyLikes.count >= 5) return false;
    
    await updateDoc(doc(db, 'users', currentUser.id), {
        'dailyLikes.count': (dailyLikes.count || 0) + 1
    });
    return true;
}

// ─── Match overlay ────────────────────────────────────────────────────────────
function showMatchOverlay(otherUser, isAdmiration = false) {
    let overlay = document.getElementById('matchOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'matchOverlay';
        overlay.innerHTML = `
            <div class="match-overlay-inner">
                <div class="match-fire">🔥</div>
                <h2 id="matchTitle">It's a Match!</h2>
                <p id="matchSubtitle">You and <strong id="matchName"></strong> like each other!</p>
                <div class="match-avatars">
                    <img id="matchYourAvatar" class="match-av">
                    <div class="match-heart">❤️</div>
                    <img id="matchTheirAvatar" class="match-av">
                </div>
                <p id="matchInfo">You can now message each other!</p>
                <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:20px;">
                    <button class="btn-primary" id="matchChatBtn"><i class="fas fa-comment"></i> Send Message</button>
                    <button class="btn-outline" onclick="closeMatchOverlay()">Keep Browsing</button>
                </div>
            </div>`;
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9999;display:flex;align-items:center;justify-content:center;animation:fadeIn 0.3s ease;';
        document.body.appendChild(overlay);
    }

    document.getElementById('matchTitle').textContent = isAdmiration ? '✨ Mutual Admiration!' : '🎉 It\'s a Match!';
    document.getElementById('matchSubtitle').innerHTML = `You and <strong>${otherUser?.name || 'someone'}</strong> ${isAdmiration ? 'admire' : 'like'} each other!`;
    document.getElementById('matchName').textContent = otherUser?.name || '';
    document.getElementById('matchYourAvatar').src = currentUser.image || avatarUrl(currentUser);
    document.getElementById('matchTheirAvatar').src = otherUser?.image || avatarUrl(otherUser);
    document.getElementById('matchInfo').textContent = 'You can now message each other!';
    
    const matchUserId = otherUser.id;
    const matchChatBtn = document.getElementById('matchChatBtn');
    
    const newBtn = matchChatBtn.cloneNode(true);
    matchChatBtn.parentNode.replaceChild(newBtn, matchChatBtn);
    
    newBtn.onclick = async (e) => {
        e.stopPropagation();
        overlay.style.display = 'none';
        setTimeout(async () => {
            const matches = await getMatches(currentUser.id);
            const userMatches = matches || [];
            if (userMatches.includes(matchUserId)) {
                openChat(matchUserId);
            } else {
                await createMutualAdmiration(matchUserId);
                setTimeout(() => openChat(matchUserId), 100);
            }
        }, 100);
    };

    overlay.style.display = 'flex';
    overlay.onclick = (e) => { if (e.target === overlay) closeMatchOverlay(); };
}

function closeMatchOverlay() {
    const overlay = document.getElementById('matchOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

window.closeMatchOverlay = closeMatchOverlay;

// ─── Fullscreen profile viewer ───────────────────────────────────────────────
function injectProfileViewerModal() {
    const existingModal = document.getElementById('fullscreenProfileModal');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.id = 'fullscreenProfileModal';
    modal.className = 'modal profile-fullscreen-modal';
    modal.innerHTML = `
        <div class="modal-content profile-fullscreen-content" id="fullscreenProfileContent">
            <button class="close-fullscreen" id="closeFullscreenBtn">
                <i class="fas fa-times"></i>
            </button>
            <div id="fullscreenProfileBody" class="fullscreen-profile-body"></div>
        </div>`;
    document.body.appendChild(modal);
    
    const closeBtn = document.getElementById('closeFullscreenBtn');
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeFullscreenModal();
        });
    }
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeFullscreenModal();
        }
    });
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
            closeFullscreenModal();
        }
    });
}

function closeFullscreenModal() {
    const modal = document.getElementById('fullscreenProfileModal');
    if (modal) {
        modal.style.display = 'none';
        const body = document.getElementById('fullscreenProfileBody');
        if (body) body.innerHTML = '';
    }
    window._fpImages = null;
    window._fpIndex = 0;
    if (window._fpAnimationTimeout) clearTimeout(window._fpAnimationTimeout);
}

window.closeFullscreenModal = closeFullscreenModal;

async function viewProfileFullscreen(userId) {
    if (!document.getElementById('fullscreenProfileModal')) {
        injectProfileViewerModal();
    }
    
    const modal = document.getElementById('fullscreenProfileModal');
    const body = document.getElementById('fullscreenProfileBody');
    if (!modal || !body) return;
    
    body.innerHTML = `<div class="fp-loading"><i class="fas fa-heart" style="font-size:2rem;animation:pulse 1s infinite;"></i></div>`;
    modal.style.display = 'flex';
    
    const users = await getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) {
        body.innerHTML = `<div class="fp-error"><i class="fas fa-exclamation-triangle"></i><p>Profile not found</p><button class="fp-action-btn like-btn" onclick="closeFullscreenModal()">Close</button></div>`;
        return;
    }
    
    // Record guest view
    const viewers = await getGuests(userId);
    if (!viewers.includes(currentUser.id)) {
        await saveGuests(userId, [...viewers, currentUser.id]);
    }
    
    const userLikes = await getLikes(currentUser.id);
    const isLiked = userLikes.includes(userId);
    const userAdmirations = await getAdmirations(currentUser.id);
    const isAdmired = isPremiumUser && userAdmirations.includes(userId);
    const userMatches = await getMatches(currentUser.id);
    const isMatch = userMatches.includes(userId);
    
    let allImages = [];
    if (user.image && user.image !== '' && !user.image.includes('ui-avatars.com')) {
        allImages.push(user.image);
    }
    if (user.gallery && Array.isArray(user.gallery)) {
        user.gallery.forEach(img => {
            if (img && img !== '' && !allImages.includes(img)) allImages.push(img);
        });
    }
    if (allImages.length === 0) allImages.push(avatarUrl(user));
    
    const hasMultiple = allImages.length > 1;
    
    body.innerHTML = `
        <div class="fp-container">
            <div class="fp-gallery-section">
                <div class="fp-image-container">
                    <img id="fpMainImg" class="fp-main-image" src="${allImages[0]}" onerror="this.src='${avatarUrl(user)}'">
                    ${hasMultiple ? `
                    <button class="fp-nav-btn fp-prev-btn" onclick="event.stopPropagation(); fpNavigate(-1)"><i class="fas fa-chevron-left"></i></button>
                    <button class="fp-nav-btn fp-next-btn" onclick="event.stopPropagation(); fpNavigate(1)"><i class="fas fa-chevron-right"></i></button>
                    <div class="fp-image-counter"><span id="fpCurrentIndex">1</span>/${allImages.length}</div>
                    ` : ''}
                </div>
                ${hasMultiple ? `
                <div class="fp-thumbnails" id="fpThumbnails">
                    ${allImages.map((src, i) => `
                        <div class="fp-thumb-wrapper ${i === 0 ? 'active' : ''}" onclick="fpGoTo(${i})">
                            <img src="${src}" class="fp-thumb-img" onerror="this.src='${avatarUrl(user)}'">
                        </div>
                    `).join('')}
                </div>
                ` : ''}
            </div>
            
            <div class="fp-info-section">
                <div class="fp-header">
                    <div class="fp-name-age">
                        <h2>${escapeHtml(user.name)}</h2>
                        <span class="fp-age">${user.age || '?'}</span>
                    </div>
                    <div class="fp-badges">
                        ${user.isPremium ? '<span class="fp-badge vip-badge"><i class="fas fa-crown"></i> VIP</span>' : ''}
                        ${isMatch ? '<span class="fp-badge match-badge"><i class="fas fa-fire"></i> Match</span>' : ''}
                    </div>
                </div>
                
                <div class="fp-location">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>${escapeHtml(user.city || 'Location hidden')}</span>
                </div>
                
                <div class="fp-bio">
                    <p>${escapeHtml(user.bio || 'No bio yet.')}</p>
                </div>
                
                <div class="fp-details">
                    ${user.occupation ? `<div class="fp-detail-item"><i class="fas fa-briefcase"></i><span class="fp-detail-value">${escapeHtml(user.occupation)}</span></div>` : ''}
                    ${user.lookingFor ? `<div class="fp-detail-item"><i class="fas fa-heart"></i><span class="fp-detail-value">${escapeHtml(user.lookingFor)}</span></div>` : ''}
                </div>
                
                ${user.exercise || user.drinking || user.smoking ? `
                <div class="fp-lifestyle">
                    <div class="fp-lifestyle-grid">
                        ${user.exercise ? `<div class="fp-lifestyle-item"><i class="fas fa-running"></i><span>${escapeHtml(user.exercise)}</span></div>` : ''}
                        ${user.drinking ? `<div class="fp-lifestyle-item"><i class="fas fa-wine-glass-alt"></i><span>${escapeHtml(user.drinking)}</span></div>` : ''}
                        ${user.smoking ? `<div class="fp-lifestyle-item"><i class="fas fa-smoking-ban"></i><span>${escapeHtml(user.smoking)}</span></div>` : ''}
                    </div>
                </div>` : ''}
                
                <div class="fp-action-buttons">
                    <button class="fp-action-btn like-btn ${isLiked ? 'active' : ''}" onclick="handleLikeFromProfile('${user.id}')">
                        <i class="fas fa-heart"></i><span>${isLiked ? 'Liked' : 'Like'}</span>
                    </button>
                    ${isPremiumUser ? `
                    <button class="fp-action-btn admire-btn ${isAdmired ? 'active' : ''}" onclick="handleAdmireFromProfile('${user.id}')">
                        <i class="fas fa-star"></i><span>${isAdmired ? 'Admired' : 'Admire'}</span>
                    </button>
                    ` : ''}
                    ${isMatch ? `
                    <button class="fp-action-btn msg-btn" onclick="closeFullscreenModal(); openChat('${user.id}')">
                        <i class="fas fa-comment"></i><span>Message</span>
                    </button>
                    ` : ''}
                </div>
            </div>
        </div>`;
    
    window._fpImages = allImages;
    window._fpIndex = 0;
    
    if (hasMultiple) {
        let touchStart = 0;
        const imgContainer = document.querySelector('.fp-image-container');
        imgContainer?.addEventListener('touchstart', e => touchStart = e.changedTouches[0].screenX);
        imgContainer?.addEventListener('touchend', e => {
            const diff = e.changedTouches[0].screenX - touchStart;
            if (Math.abs(diff) > 50) fpNavigate(diff > 0 ? -1 : 1);
        });
    }
}

window.fpNavigate = function(dir) {
    const imgs = window._fpImages || [];
    if (imgs.length <= 1) return;
    const newIndex = (window._fpIndex + dir + imgs.length) % imgs.length;
    fpGoTo(newIndex);
};

window.fpGoTo = function(i) {
    const imgs = window._fpImages || [];
    if (i === window._fpIndex) return;
    window._fpIndex = i;
    const mainImg = document.getElementById('fpMainImg');
    if (mainImg) {
        mainImg.style.opacity = '0.5';
        setTimeout(() => { mainImg.src = imgs[i]; mainImg.style.opacity = '1'; }, 150);
    }
    const counter = document.getElementById('fpCurrentIndex');
    if (counter) counter.textContent = String(i + 1);
    document.querySelectorAll('.fp-thumb-wrapper').forEach((w, idx) => w.classList.toggle('active', idx === i));
};

async function handleAdmireFromProfile(userId) {
    await handleAdmire(userId, null);
    showToast('⭐ Admiration sent!');
    const admireBtn = document.querySelector('.fp-action-btn.admire-btn');
    if (admireBtn) {
        admireBtn.classList.add('active');
        admireBtn.innerHTML = '<i class="fas fa-star"></i><span>Admired</span>';
    }
}

window.handleAdmireFromProfile = handleAdmireFromProfile;

async function handleLikeFromProfile(userId) {
    const likeBtn = document.querySelector('.fp-action-btn.like-btn');
    await handleLike(userId, null);
    const userLikes = await getLikes(currentUser.id);
    const liked = userLikes.includes(userId);
    if (likeBtn) {
        likeBtn.classList.toggle('active', liked);
        likeBtn.innerHTML = `<i class="fas fa-heart"></i><span>${liked ? 'Liked' : 'Like'}</span>`;
    }
}

window.handleLikeFromProfile = handleLikeFromProfile;

// ─── Chat modal (legacy) ──────────────────────────────────────────────────────
function injectChatModal() {
    const modal = document.createElement('div');
    modal.id = 'chatModal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content chat-modal-content">
            <div class="chat-header">
                <img id="chatAvatar" src="" class="chat-header-avatar">
                <div>
                    <div id="chatUserName" style="font-weight:700;font-size:1.1rem;"></div>
                    <div style="font-size:0.8rem;color:#ff4d6d;">Mutual Admiration ❤️</div>
                </div>
                <button class="close-modal" style="margin-left:auto;" onclick="document.getElementById('chatModal').style.display='none';clearInterval(chatPollingInterval);">&times;</button>
            </div>
            <div class="chat-messages" id="chatMessages"></div>
            <div class="chat-input-area">
                <input type="text" id="chatInput" class="chat-input" placeholder="Type a message..." maxlength="500">
                <button class="chat-send-btn" id="chatSendBtn"><i class="fas fa-paper-plane"></i></button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) { modal.style.display = 'none'; clearInterval(chatPollingInterval); } });

    document.getElementById('chatSendBtn').addEventListener('click', sendChatMessage);
    document.getElementById('chatInput').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } });
}

window.openChat = async function(userId) {
    const user = allUsers.find(u => u.id === userId) || (await getUsers()).find(u => u.id === userId);
    if (!user) {
        showToast('User not found', 'error');
        return;
    }

    const userMatches = await getMatches(currentUser.id);
    
    if (!userMatches.includes(userId)) {
        await createMutualAdmiration(userId);
        
        const updatedUserMatches = await getMatches(currentUser.id);
        
        if (!updatedUserMatches.includes(userId)) {
            showToast('You can only message people who are a mutual match! Like each other first. ❤️', 'warning');
            return;
        }
    }

    activeChatUserId = userId;
    
    const matchOverlay = document.getElementById('matchOverlay');
    if (matchOverlay) matchOverlay.style.display = 'none';
    
    await showContentSection('messages-side');
    
    document.querySelectorAll('.side-nav-item').forEach(i => i.classList.remove('active'));
    const messagesNavItem = document.querySelector('.side-nav-item[data-view="messages-side"]');
    if (messagesNavItem) messagesNavItem.classList.add('active');
    
    document.querySelectorAll('.second-nav-btn').forEach(b => b.classList.remove('active'));
    const messagesSecondNav = document.querySelector('.second-nav-btn[data-section="messages"]');
    if (messagesSecondNav) messagesSecondNav.classList.add('active');
    
    await renderChatConversationView(user);
    
    if (chatPollingInterval) clearInterval(chatPollingInterval);
    
    chatPollingInterval = setInterval(async () => {
        if (activeChatUserId && document.getElementById('chatMessagesSection')) {
            await renderChatMessagesInSection();
        }
    }, 2000);
    
    await markMessagesAsRead(userId);
};

function isMobile() { return window.innerWidth <= 640; }

async function renderConversationListHTML(userMatches) {
    if (userMatches.length === 0) return '';
    let html = '';
    for (const matchId of userMatches) {
        const u = allUsers.find(m => m.id === matchId);
        if (!u) continue;
        const messages = await getAllConversationMessages(matchId);
        const last = messages[messages.length - 1];
        const unreadCount = await getUnreadCount(matchId);
        const isActive = activeChatUserId === matchId;
        html += `
        <div class="conversation-item${isActive ? ' conv-active' : ''}" onclick="openChat('${matchId}')">
            <div class="conv-avatar-wrap">
                <img src="${u.image || avatarUrl(u)}" class="conv-avatar" alt="${u.name}">
                <span class="conv-online-dot ${u.isOnline ? '' : 'offline'}"></span>
            </div>
            <div class="conv-info">
                <div class="conv-name-row">
                    <span class="conv-name">${u.name}</span>
                    <span class="conv-time">${last ? new Date(last.timestamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : ''}</span>
                </div>
                <div class="conv-preview-row">
                    <span class="conv-preview">${last ? (last.senderId === currentUser.id ? 'You: ' : '') + escapeHtml(last.text.substring(0,40)) + (last.text.length > 40 ? '…' : '') : 'Tap to start chatting! 👋'}</span>
                    ${unreadCount > 0 ? `<span class="conv-badge">${unreadCount}</span>` : ''}
                </div>
            </div>
        </div>`;
    }
    return html;
}

async function loadMessagesSideView() {
    const container = document.querySelector('#messagesSideSection .messages-container');
    if (!container) return;

    const userMatches = await getMatches(currentUser.id);

    if (userMatches.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-comment-dots"></i>
                <p>No matches yet. Keep liking!</p>
                <p style="font-size:0.85rem;margin-top:10px;">When someone likes you back, you can chat here 💬</p>
            </div>`;
        return;
    }

    if (isMobile()) {
        if (activeChatUserId) {
            const activeUser = allUsers.find(u => u.id === activeChatUserId);
            if (activeUser) { renderMobileChatView(activeUser); return; }
        }
        await renderMobileListView(userMatches);
    } else {
        if (activeChatUserId) {
            const activeUser = allUsers.find(u => u.id === activeChatUserId);
            if (activeUser) { await renderChatConversationView(activeUser); return; }
        }
        await renderDesktopListView(userMatches);
    }
}

async function renderMobileListView(userMatches) {
    const container = document.querySelector('#messagesSideSection .messages-container');
    if (!container) return;
    const convListHtml = await renderConversationListHTML(userMatches);
    container.innerHTML = `
        <div class="msg-mobile-list">
            <div class="msg-panel-header">
                <h3><i class="fas fa-comments" style="color:var(--pink)"></i> Messages</h3>
            </div>
            <div class="conv-list" id="conversationsList">
                ${convListHtml}
            </div>
        </div>`;
}

function renderMobileChatView(user) {
    const container = document.querySelector('#messagesSideSection .messages-container');
    if (!container) return;
    container.innerHTML = `
        <div class="msg-mobile-chat">
            <div class="chat-panel-header">
                <button class="chat-back-btn" onclick="activeChatUserId=null;clearInterval(chatPollingInterval);loadMessagesSideView();">
                    <i class="fas fa-arrow-left"></i>
                </button>
                <img src="${user.image || avatarUrl(user)}" class="chat-hdr-avatar" alt="${user.name}">
                <div class="chat-hdr-info">
                    <div class="chat-hdr-name">${user.name}</div>
                    <div class="chat-hdr-sub"><i class="fas fa-fire" style="color:var(--pink)"></i> Mutual Admiration</div>
                </div>
                <button class="chat-report-btn" onclick="openReportModal('${user.id}','${user.name}')" title="Report user">
                    <i class="fas fa-flag"></i>
                </button>
            </div>
            <div id="chatMessagesSection" class="chat-messages-area">
                ${renderChatMessagesHTMLSync()}
            </div>
            <div class="chat-input-row">
                <input type="text" id="chatInputSection" class="chat-input" placeholder="Type a message…" maxlength="500">
                <button id="chatSendBtnSection" class="chat-send-btn"><i class="fas fa-paper-plane"></i></button>
            </div>
        </div>`;
    attachChatSectionListeners();
}

async function renderDesktopListView(userMatches) {
    const container = document.querySelector('#messagesSideSection .messages-container');
    if (!container) return;
    const convListHtml = await renderConversationListHTML(userMatches);
    container.innerHTML = `
        <div class="msg-desktop-layout">
            <div class="msg-sidebar">
                <div class="msg-panel-header">
                    <h3><i class="fas fa-comments" style="color:var(--pink)"></i> Conversations</h3>
                </div>
                <div class="conv-list" id="conversationsList">
                    ${convListHtml}
                </div>
            </div>
            <div class="msg-chat-pane" id="chatAreaContainer">
                <div class="chat-empty-state">
                    <i class="fas fa-comment-dots"></i>
                    <p>Select a conversation</p>
                </div>
            </div>
        </div>`;
}

async function renderChatConversationView(user) {
    const container = document.querySelector('#messagesSideSection .messages-container');
    if (!container) return;

    if (isMobile()) { renderMobileChatView(user); return; }

    const userMatches = await getMatches(currentUser.id);
    const convListHtml = await renderConversationListHTML(userMatches);
    const chatMessagesHtml = await renderChatMessagesHTML();

    container.innerHTML = `
        <div class="msg-desktop-layout">
            <div class="msg-sidebar">
                <div class="msg-panel-header">
                    <h3><i class="fas fa-comments" style="color:var(--pink)"></i> Conversations</h3>
                </div>
                <div class="conv-list" id="conversationsList">
                    ${convListHtml}
                </div>
            </div>
            <div class="msg-chat-pane">
                <div class="chat-panel-header">
                    <img src="${user.image || avatarUrl(user)}" class="chat-hdr-avatar" alt="${user.name}">
                    <div class="chat-hdr-info">
                        <div class="chat-hdr-name">${user.name}, ${user.age}</div>
                        <div class="chat-hdr-sub"><i class="fas fa-fire" style="color:var(--pink)"></i> Mutual Admiration</div>
                    </div>
                    <button class="chat-report-btn" onclick="openReportModal('${user.id}','${user.name}')" title="Report user">
                        <i class="fas fa-flag"></i>
                    </button>
                    <button class="chat-close-btn" onclick="activeChatUserId=null;clearInterval(chatPollingInterval);loadMessagesSideView();">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div id="chatMessagesSection" class="chat-messages-area">
                    ${chatMessagesHtml}
                </div>
                <div class="chat-input-row">
                    <input type="text" id="chatInputSection" class="chat-input" placeholder="Type a message…" maxlength="500">
                    <button id="chatSendBtnSection" class="chat-send-btn"><i class="fas fa-paper-plane"></i></button>
                </div>
            </div>
        </div>`;
    attachChatSectionListeners();
}

function attachChatSectionListeners() {
    const sendBtn = document.getElementById('chatSendBtnSection');
    const inputField = document.getElementById('chatInputSection');
    if (sendBtn) sendBtn.addEventListener('click', sendChatMessageSection);
    if (inputField) {
        inputField.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) { 
                e.preventDefault(); 
                if (window._readOnlyModeActive === true || !isPremiumUser) {
                    showToast('🔒 Your free session has ended. Upgrade to continue messaging!', 'warning');
                    openSubscriptionModal();
                    return;
                }
                sendChatMessageSection(); 
            }
        });
        setTimeout(() => inputField.focus(), 200);
    }
    const messagesContainer = document.getElementById('chatMessagesSection');
    if (messagesContainer) messagesContainer.scrollTop = messagesContainer.scrollHeight;
    markMessagesAsRead(activeChatUserId);
}

function renderChatMessagesHTMLSync() {
    if (!activeChatUserId) return '<div style="text-align:center;color:#aaa;padding:40px;">Select a conversation</div>';
    
    const otherUser = allUsers.find(u => u.id === activeChatUserId);
    
    return `
        <div style="text-align:center;color:#aaa;padding:60px 20px;">
            <i class="fas fa-heart" style="font-size:3rem;color:#ffcdd2;"></i>
            <p style="margin-top:16px;">Loading messages...</p>
        </div>`;
}

async function renderChatMessagesHTML() {
    if (!activeChatUserId) return '<div style="text-align:center;color:#aaa;padding:40px;">Select a conversation</div>';
    
    const msgs = await getAllConversationMessages(activeChatUserId);
    const otherUser = allUsers.find(u => u.id === activeChatUserId);
    
    if (msgs.length === 0) {
        return `
            <div style="text-align:center;color:#aaa;padding:60px 20px;">
                <i class="fas fa-heart" style="font-size:3rem;color:#ffcdd2;"></i>
                <p style="margin-top:16px;">You're a mutual match! 🎉</p>
                <p style="font-size:0.85rem;">Say hello to ${otherUser?.name || 'them'}!</p>
            </div>`;
    }
    
    return msgs.map(msg => {
        const isMine = msg.senderId === currentUser.id;
        const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        return `
            <div style="display:flex;justify-content:${isMine ? 'flex-end' : 'flex-start'};margin-bottom:12px;">
                <div style="max-width:70%;">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;${isMine ? 'justify-content:flex-end' : 'justify-content:flex-start'}">
                        ${!isMine ? `<img src="${otherUser?.image || avatarUrl(otherUser)}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;">` : ''}
                        <span style="font-size:0.7rem;color:#aaa;">${time}</span>
                    </div>
                    <div style="background:${isMine ? 'linear-gradient(135deg,#ff4d6d,#ff758f)' : 'white'};color:${isMine ? 'white' : '#1a1a2e'};padding:10px 14px;border-radius:${isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px'};box-shadow:0 1px 2px rgba(0,0,0,0.05);word-break:break-word;">
                        ${escapeHtml(msg.text)}
                    </div>
                </div>
            </div>`;
    }).join('');
}

async function renderChatMessagesInSection() {
    const container = document.getElementById('chatMessagesSection');
    if (!container || !activeChatUserId) return;
    
    const wasAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 50;
    const isReadOnly = window._readOnlyModeActive === true;
    
    container.innerHTML = await renderChatMessagesHTML();
    
    if (isReadOnly && !document.getElementById('chatDisabledOverlay')) {
        const overlayMsg = document.createElement('div');
        overlayMsg.id = 'chatDisabledOverlay';
        overlayMsg.style.cssText = `
            text-align: center;
            padding: 12px 16px;
            margin: 8px 16px;
            background: linear-gradient(135deg, #fff5f7, white);
            border-radius: 20px;
            border: 1px solid #ffe2ec;
            font-size: 0.8rem;
            color: #ff4d6d;
        `;
        overlayMsg.innerHTML = `
            <i class="fas fa-lock"></i> 
            <strong>Chat is locked</strong> — Your free session has ended. 
            <button onclick="openSubscriptionModal()" style="background:none; border:none; color:#ff4d6d; font-weight:600; cursor:pointer; text-decoration:underline;">
                Upgrade to continue messaging
            </button>
        `;
        container.insertBefore(overlayMsg, container.firstChild);
    }
    
    if (wasAtBottom) {
        container.scrollTop = container.scrollHeight;
    }
    
    await markMessagesAsRead(activeChatUserId);
}

async function sendChatMessageSection() {
    if (window._readOnlyModeActive === true || !isPremiumUser) {
        showToast('🔒 Your free session has ended. Upgrade to continue messaging!', 'warning');
        openSubscriptionModal();
        return;
    }
    
    const input = document.getElementById('chatInputSection');
    const text = input?.value.trim();
    if (!text || !activeChatUserId) return;
    
    const newMessage = { 
        senderId: currentUser.id, 
        text, 
        timestamp: new Date().toISOString(),
        read: false
    };
    
    await saveConversation(activeChatUserId, newMessage);
    
    input.value = '';
    await renderChatMessagesInSection();
    
    const convList = document.getElementById('conversationsList');
    if (convList) {
        const userMatches = await getMatches(currentUser.id);
        convList.innerHTML = await renderConversationListHTML(userMatches);
    }
}

async function getUnreadCount(userId) {
    const messages = await getAllConversationMessages(userId);
    return messages.filter(msg => msg.senderId === userId && !msg.read).length;
}

async function markMessagesAsRead(userId) {
    const convId = getChatKey(currentUser.id, userId);
    const messagesSnapshot = await getDocs(collection(db, 'conversations', convId, 'messages'));
    
    const batch = writeBatch(db);
    messagesSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.senderId === userId && !data.read) {
            batch.update(doc.ref, { read: true });
        }
    });
    
    await batch.commit();
}

function openMessagesModal() {
    showContentSection('messages-side');
    document.querySelectorAll('.side-nav-item').forEach(i => i.classList.remove('active'));
    document.querySelector('.side-nav-item[data-view="messages-side"]').classList.add('active');
    document.querySelectorAll('.second-nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.second-nav-btn[data-section="messages"]').classList.add('active');
}

async function renderChatMessages() {
    if (!activeChatUserId) return;
    const msgs = await getAllConversationMessages(activeChatUserId);
    const container = document.getElementById('chatMessages');
    if (!container) return;

    const wasAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 50;
    const isReadOnly = window._readOnlyModeActive === true;

    container.innerHTML = msgs.length === 0
        ? `<div style="text-align:center;color:#aaa;padding:40px 20px;"><i class="fas fa-heart" style="font-size:2rem;color:#ffcdd2;"></i><br><br>Say hello! You're a mutual match 🎉</div>`
        : msgs.map(msg => {
            const isMine = msg.senderId === currentUser.id;
            const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return `
            <div class="chat-msg ${isMine ? 'chat-msg-mine' : 'chat-msg-theirs'}">
                <div class="chat-bubble-wrap">
                    <div class="chat-bubble ${isMine ? 'mine' : 'theirs'}">${escapeHtml(msg.text)}</div>
                    <div class="chat-time">${time}</div>
                </div>
            </div>`;
        }).join('');
    
    if (isReadOnly && !document.getElementById('chatDisabledOverlayMobile')) {
        const overlayMsgMobile = document.createElement('div');
        overlayMsgMobile.id = 'chatDisabledOverlayMobile';
        overlayMsgMobile.style.cssText = `
            text-align: center;
            padding: 12px 16px;
            margin: 8px 16px;
            background: linear-gradient(135deg, #fff5f7, white);
            border-radius: 20px;
            border: 1px solid #ffe2ec;
            font-size: 0.8rem;
            color: #ff4d6d;
        `;
        overlayMsgMobile.innerHTML = `
            <i class="fas fa-lock"></i> 
            <strong>Chat is locked</strong> — Your free session has ended. 
            <button onclick="openSubscriptionModal()" style="background:none; border:none; color:#ff4d6d; font-weight:600; cursor:pointer; text-decoration:underline;">
                Upgrade to continue messaging
            </button>
        `;
        container.insertBefore(overlayMsgMobile, container.firstChild);
    }

    if (wasAtBottom) container.scrollTop = container.scrollHeight;
}

async function sendChatMessage() {
    if (window._readOnlyModeActive === true || !isPremiumUser) {
        showToast('🔒 Your free session has ended. Upgrade to continue messaging!', 'warning');
        openSubscriptionModal();
        return;
    }
    
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text || !activeChatUserId) return;

    const newMessage = { 
        senderId: currentUser.id, 
        text, 
        timestamp: new Date().toISOString(),
        read: false
    };
    
    await saveConversation(activeChatUserId, newMessage);

    input.value = '';
    await renderChatMessages();
}

function escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function loadLikes() {
    const container = document.querySelector('#likesSection .likes-container');
    if (!container) return;
    
    const receivedIds = await getReceivedLikes(currentUser.id);
    const allUsersData = await getUsers();
    const likedUsers = receivedIds.map(id => allUsersData.find(u => u.id === id)).filter(Boolean);

    if (likedUsers.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-heart"></i><p>No likes yet — keep browsing!</p></div>`;
    } else {
        container.innerHTML = `
            <div class="list-section-header">
                <h2><i class="fas fa-heart" style="color:var(--pink);"></i> Likes</h2>
            </div>
            <div class="likes-list">
                ${likedUsers.map(user => renderListCard(user, 'like')).join('')}
            </div>`;
    }
}

async function loadMutually() {
    const container = document.querySelector('#mutuallySection .mutually-container');
    if (!container) return;
    
    const matchedIds = await getMatches(currentUser.id);
    const allUsersData = await getUsers();
    const matchedUsers = matchedIds.map(id => allUsersData.find(u => u.id === id)).filter(Boolean);

    if (matchedUsers.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-fire"></i><p>No mutual admirations yet. Like someone who likes you back!</p></div>`;
    } else {
        container.innerHTML = `
            <div class="list-section-header">
                <h2><i class="fas fa-fire" style="color:var(--pink);"></i> Mutually</h2>
            </div>
            <div class="mutually-list">
                ${matchedUsers.map(user => renderListCard(user, 'mutual')).join('')}
            </div>`;
    }
}

async function loadGuests() {
    const container = document.querySelector('#guestsSection .guests-container');
    if (!container) return;
    
    const viewerIds = await getGuests(currentUser.id);
    const allUsersData = await getUsers();
    const guestUsers = viewerIds.map(id => allUsersData.find(u => u.id === id)).filter(Boolean);

    if (guestUsers.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-users"></i><p>No profile views yet</p></div>`;
    } else {
        container.innerHTML = `
            <div class="list-section-header">
                <h2><i class="fas fa-eye" style="color:var(--pink);"></i> Profile Views</h2>
            </div>
            <div class="guests-list">
                ${guestUsers.map(user => renderListCard(user, 'guest')).join('')}
            </div>`;
    }
}

function renderListCard(user, type) {
    const isOnline = user.isOnline || Math.random() > 0.7;
    const viewDate = new Date();
    const formattedDate = `${String(viewDate.getDate()).padStart(2,'0')}-${String(viewDate.getMonth()+1).padStart(2,'0')}-${viewDate.getFullYear()}, ${String(viewDate.getHours()).padStart(2,'0')}:${String(viewDate.getMinutes()).padStart(2,'0')}`;
    
    let actionButtons = '';
    
    if (type === 'like') {
        actionButtons = `
            <button class="list-card-btn list-card-btn-primary" onclick="handleLikeFromList('${user.id}', this)">
                <i class="fas fa-heart"></i> Like Back
            </button>
        `;
    } else if (type === 'mutual') {
        actionButtons = `
            <button class="list-card-btn list-card-btn-primary" onclick="openChat('${user.id}')">
                <i class="fas fa-comment"></i> Message
            </button>
            <button class="list-card-btn list-card-btn-outline">
                <i class="fas fa-archive"></i> To archive
            </button>
            <button class="list-card-btn list-card-btn-danger">
                <i class="fas fa-trash"></i> Remove
            </button>
        `;
    } else if (type === 'guest') {
        actionButtons = `
            <button class="list-card-btn list-card-btn-primary" onclick="viewProfileFullscreen('${user.id}')">
                <i class="fas fa-eye"></i> View Profile
            </button>
            <button class="list-card-btn list-card-btn-outline" onclick="handleLike('${user.id}', null)">
                <i class="fas fa-heart"></i> Like
            </button>
        `;
    }
    
    return `
        <div class="list-card">
            <div class="list-card-left">
                <div class="list-card-avatar">
                    <img src="${user.image || avatarUrl(user)}" alt="${user.name}">
                    <div class="list-card-online ${isOnline ? '' : 'offline'}"></div>
                </div>
                <div class="list-card-info">
                    <div class="list-card-name">
                        ${user.name} <small>${user.age} years, ${user.city || 'Unknown'}</small>
                    </div>
                    <div class="list-card-date">
                        <i class="far fa-clock"></i> ${formattedDate}
                    </div>
                </div>
            </div>
            <div class="list-card-right">
                ${actionButtons}
            </div>
        </div>
    `;
}

window.handleLikeFromList = async function(userId, btn) {
    if (!isPremiumUser && !(await checkFreeUserLikeLimit())) {
        showToast('Free users can send 5 likes/day. Upgrade for unlimited! 💎', 'warning');
        openSubscriptionModal();
        return;
    }

    const userLikes = await getLikes(currentUser.id);

    if (userLikes.includes(userId)) {
        showToast('You already liked this person ❤️');
        return;
    }

    await saveLikes(currentUser.id, [...userLikes, userId]);
    
    const receivedLikes = await getReceivedLikes(userId);
    if (!receivedLikes.includes(currentUser.id)) {
        await saveReceivedLikes(userId, [...receivedLikes, currentUser.id]);
    }

    const theirLikes = await getLikes(userId);
    if (theirLikes.includes(currentUser.id)) {
        await createMutualAdmiration(userId);
        const otherUser = allUsers.find(u => u.id === userId);
        showMatchOverlay(otherUser);
    } else {
        showToast('❤️ Like sent!');
    }
    
    if (btn) {
        btn.innerHTML = '<i class="fas fa-check"></i> Liked!';
        btn.disabled = true;
        setTimeout(async () => {
            await loadLikes();
            await loadMutually();
        }, 500);
    }
};

function renderMiniCard(user, showLike = false) {
    return `
    <div class="product-card" style="min-width:240px;">
        <div class="card-image" onclick="viewProfileFullscreen('${user.id}')">
            <img src="${user.image || avatarUrl(user)}" alt="${user.name}">
        </div>
        <div class="card-info">
            <h3>${user.name}, ${user.age}</h3>
            <div class="card-description">${user.city || ''}</div>
        </div>
        <div class="card-footer">
            ${showLike ? `<button class="like-icon" onclick="handleLike('${user.id}',this)"><i class="fas fa-heart"></i></button>` : ''}
            <button class="camera-icon" onclick="viewProfileFullscreen('${user.id}')"><i class="fas fa-eye"></i></button>
        </div>
    </div>`;
}

async function startTimerIfNeeded() {
    if (isPremiumUser) return;

    const userDoc = await getDoc(doc(db, 'users', currentUser.id));
    const userData = userDoc.data();
    const session = userData.freeSession || {};
    const today = new Date().toDateString();

    if (session.date === today && session.remaining > 0) {
        timeRemaining = session.remaining;
    } else if (session.date !== today) {
        timeRemaining = 5 * 60;
        await updateDoc(doc(db, 'users', currentUser.id), {
            'freeSession.date': today,
            'freeSession.remaining': timeRemaining
        });
    } else {
        logoutFreeUser();
        return;
    }

    startTimer();
}

let warningTriggered = false;

function startTimer() {
    const timerWarning = document.getElementById('timerWarning');
    const timerDisplay = document.getElementById('timerDisplay');
    if (!timerWarning || !timerDisplay) return;

    timerWarning.style.display = 'none';

    if (timerInterval) clearInterval(timerInterval);

    timerInterval = setInterval(async () => {
        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            logoutFreeUser();
            return;
        }
        
        timeRemaining--;

        if (timeRemaining === 60 && !warningTriggered) {
            warningTriggered = true;
            timerWarning.style.display = 'block';
            timerWarning.style.background = 'linear-gradient(90deg, #ff9800, #ffb74d)';
            timerWarning.style.animation = 'pulse 1s infinite';
            
            const timerContent = timerWarning.querySelector('.timer-content');
            if (timerContent) {
                timerContent.innerHTML = `
                    <i class="fas fa-hourglass-half"></i>
                    <span>⚠️ 1 minute remaining!</span>
                    <button onclick="openSubscriptionModal()" class="timer-upgrade-btn">Upgrade <i class="fas fa-crown"></i></button>
                `;
            }
            
            showToast("⚠️ Your free session ends in 1 minute! Upgrade to continue uninterrupted →", "warning");
        }

        if (timeRemaining % 5 === 0) {
            await updateDoc(doc(db, 'users', currentUser.id), {
                'freeSession.remaining': timeRemaining
            });
        }
    }, 1000);
}

function logoutFreeUser() {
    clearInterval(timerInterval);
    showEngagingUpgradeModal();
}

async function showEngagingUpgradeModal() {
    if (document.getElementById('engagingUpgradeModal')) return;
    
    const receivedLikes = await getReceivedLikes(currentUser.id);
    const receivedAdmirations = await getReceivedAdmirations(currentUser.id);
    const userMatches = await getMatches(currentUser.id);
    
    const allUsersData = await getUsers();
    const likedUsers = receivedLikes.map(id => allUsersData.find(u => u.id === id)).filter(Boolean).slice(0, 3);
    const totalMissed = receivedLikes.length + receivedAdmirations.length;
    const premiumCount = allUsersData.filter(u => u.isPremium === true).length;
    const todayJoins = Math.floor(Math.random() * 15) + 8;
    
    const modal = document.createElement('div');
    modal.id = 'engagingUpgradeModal';
    modal.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.92);
        backdrop-filter: blur(8px);
        z-index: 20000;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.4s ease;
        font-family: 'Plus Jakarta Sans', sans-serif;
    `;
    
    modal.innerHTML = `
        <div style="
            background: linear-gradient(145deg, #ffffff, #fff8f9);
            border-radius: 48px;
            max-width: 520px;
            width: 92%;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 40px 80px rgba(0,0,0,0.3);
            animation: slideUp 0.4s cubic-bezier(0.34, 1.2, 0.64, 1);
            position: relative;
        ">
            <button onclick="closeEngagingModal()" style="
                position: absolute;
                right: 20px;
                top: 20px;
                background: rgba(0,0,0,0.05);
                border: none;
                width: 40px;
                height: 40px;
                border-radius: 50%;
                font-size: 1.2rem;
                cursor: pointer;
                color: #999;
                transition: all 0.2s;
                z-index: 10;
            " onmouseover="this.style.background='#ff4d6d';this.style.color='white'" 
               onmouseout="this.style.background='rgba(0,0,0,0.05)';this.style.color='#999'">
                ✕
            </button>
            
            <div style="padding: 40px 32px 32px;">
                <div style="text-align: center; margin-bottom: 24px;">
                    <div style="
                        background: linear-gradient(135deg, #ff4d6d, #ff758f);
                        width: 70px;
                        height: 70px;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin: 0 auto 16px;
                        box-shadow: 0 8px 20px rgba(255,77,109,0.3);
                    ">
                        <i class="fas fa-hourglass-half" style="font-size: 2rem; color: white;"></i>
                    </div>
                    <h2 style="font-size: 1.8rem; font-weight: 800; margin-bottom: 8px;">
                        Your Free Session <span style="color: #ff4d6d;">Is Complete</span>
                    </h2>
                    <p style="color: #666; font-size: 0.95rem;">
                        But you're not locked out — your matches are waiting! ✨
                    </p>
                </div>
                
                <div style="
                    background: linear-gradient(135deg, #fff5f7, white);
                    border-radius: 28px;
                    padding: 20px;
                    margin-bottom: 20px;
                    border: 1px solid #ffe2ec;
                ">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
                        <i class="fas fa-fire" style="color: #ff4d6d; font-size: 1.3rem;"></i>
                        <span style="font-weight: 700; font-size: 0.9rem;">You missed while away</span>
                        <span style="margin-left: auto; background: #ff4d6d; color: white; padding: 2px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 700;">
                            ${totalMissed > 0 ? totalMissed : '2'} new
                        </span>
                    </div>
                    
                    <div style="display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap;">
                        ${likedUsers.length > 0 ? likedUsers.map(user => `
                            <div style="text-align: center; flex: 1; min-width: 80px;">
                                <div style="
                                    width: 70px;
                                    height: 70px;
                                    margin: 0 auto 8px;
                                    border-radius: 50%;
                                    overflow: hidden;
                                    filter: blur(6px);
                                    background: #ddd;
                                    border: 2px solid #ffe2ec;
                                ">
                                    <img src="${user.image || avatarUrl(user)}" style="width: 100%; height: 100%; object-fit: cover;">
                                </div>
                                <div style="font-size: 0.7rem; color: #999; filter: blur(3px);">${user.name || 'Someone'}</div>
                                <div style="font-size: 0.65rem; color: #ff4d6d; margin-top: 4px;">
                                    <i class="fas fa-heart"></i> Liked you
                                </div>
                            </div>
                        `).join('') : `
                            <div style="flex: 1; text-align: center; padding: 12px; background: rgba(255,77,109,0.05); border-radius: 20px;">
                                <i class="fas fa-heart" style="color: #ff4d6d; font-size: 1.5rem; margin-bottom: 8px; display: block;"></i>
                                <span style="font-size: 0.8rem; color: #666;">New likes waiting</span>
                            </div>
                        `}
                    </div>
                    
                    ${userMatches.length > 0 ? `
                        <div style="
                            background: white;
                            border-radius: 20px;
                            padding: 12px;
                            display: flex;
                            align-items: center;
                            gap: 10px;
                            border-left: 4px solid #ff4d6d;
                        ">
                            <i class="fas fa-comment-dots" style="color: #ff4d6d;"></i>
                            <div style="flex: 1;">
                                <div style="font-weight: 600; font-size: 0.85rem;">${userMatches.length} mutual admiration${userMatches.length > 1 ? 's' : ''}</div>
                                <div style="font-size: 0.7rem; color: #999; filter: blur(3px);">Someone sent you a message...</div>
                            </div>
                            <i class="fas fa-lock" style="color: #ccc;"></i>
                        </div>
                    ` : `
                        <div style="
                            background: white;
                            border-radius: 20px;
                            padding: 12px;
                            display: flex;
                            align-items: center;
                            gap: 10px;
                            opacity: 0.7;
                        ">
                            <i class="fas fa-comment-dots" style="color: #ccc;"></i>
                            <div style="flex: 1;">
                                <div style="font-weight: 600; font-size: 0.85rem;">Messages are locked</div>
                                <div style="font-size: 0.7rem; color: #999;">Upgrade to chat with matches</div>
                            </div>
                            <i class="fas fa-lock" style="color: #ccc;"></i>
                        </div>
                    `}
                </div>
                
                <div style="
                    display: flex;
                    gap: 16px;
                    margin-bottom: 24px;
                    justify-content: center;
                ">
                    <div style="text-align: center;">
                        <div style="font-size: 1.5rem; font-weight: 800; color: #ff4d6d;">${premiumCount}+</div>
                        <div style="font-size: 0.7rem; color: #999;">Premium Members</div>
                    </div>
                    <div style="width: 1px; background: #eee;"></div>
                    <div style="text-align: center;">
                        <div style="font-size: 1.5rem; font-weight: 800; color: #ff4d6d;">${todayJoins}</div>
                        <div style="font-size: 0.7rem; color: #999;">Joined Today</div>
                    </div>
                    <div style="width: 1px; background: #eee;"></div>
                    <div style="text-align: center;">
                        <div style="font-size: 1.5rem; font-weight: 800; color: #ff4d6d;">92%</div>
                        <div style="font-size: 0.7rem; color: #999;">Find Match in 1 Week</div>
                    </div>
                </div>
                
                <div style="
                    background: linear-gradient(135deg, #ff4d6d10, #ff758f10);
                    border-radius: 24px;
                    padding: 16px;
                    margin-bottom: 24px;
                    text-align: center;
                    border: 1px dashed #ff4d6d;
                ">
                    <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 8px;">
                        <i class="fas fa-clock" style="color: #ff4d6d;"></i>
                        <span style="font-weight: 700; font-size: 0.85rem;">Limited Time Offer</span>
                        <i class="fas fa-tag" style="color: #ff4d6d;"></i>
                    </div>
                    <div style="font-size: 1.2rem; font-weight: 800; color: #ff4d6d;">
                        Save 30% on Premium
                    </div>
                    <div style="font-size: 0.7rem; color: #666; margin-top: 6px;">
                        Offer expires in <span id="discountTimer" style="font-weight: 700; color: #ff4d6d;">15:00</span>
                    </div>
                </div>
                
                <div style="display: flex; gap: 12px; flex-direction: column;">
                    <button id="engagingUpgradeBtn" style="
                        background: linear-gradient(135deg, #ff4d6d, #ff758f);
                        border: none;
                        color: white;
                        padding: 16px;
                        border-radius: 60px;
                        font-weight: 800;
                        font-size: 1rem;
                        cursor: pointer;
                        transition: all 0.2s;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 10px;
                        box-shadow: 0 8px 20px rgba(255,77,109,0.3);
                    " onmouseover="this.style.transform='scale(1.02)';this.style.boxShadow='0 12px 28px rgba(255,77,109,0.4)'"
                       onmouseout="this.style.transform='scale(1)';this.style.boxShadow='0 8px 20px rgba(255,77,109,0.3)'">
                        <i class="fas fa-unlock-alt"></i>
                        Unlock All Features Now
                        <i class="fas fa-arrow-right"></i>
                    </button>
                    
                    <button id="engagingBrowseBtn" style="
                        background: transparent;
                        border: 2px solid #ffe2ec;
                        color: #ff4d6d;
                        padding: 14px;
                        border-radius: 60px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.2s;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 8px;
                    " onmouseover="this.style.borderColor='#ff4d6d';this.style.background='#fff5f7'"
                       onmouseout="this.style.borderColor='#ffe2ec';this.style.background='transparent'">
                        <i class="fas fa-eye"></i>
                        Browse Profiles (Read Only)
                    </button>
                </div>
                
                <p style="
                    text-align: center;
                    font-size: 0.7rem;
                    color: #aaa;
                    margin-top: 20px;
                ">
                    <i class="fas fa-shield-alt"></i> No lockout • Upgrade anytime • Cancel easily
                </p>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    let timeLeft = 15 * 60;
    const timerElement = document.getElementById('discountTimer');
    const discountTimerInterval = setInterval(() => {
        if (timeLeft <= 0) {
            clearInterval(discountTimerInterval);
            if (timerElement) timerElement.textContent = "Expired";
        } else {
            timeLeft--;
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            if (timerElement) timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
    }, 1000);
    
    modal.timerInterval = discountTimerInterval;
    
    document.getElementById('engagingUpgradeBtn').addEventListener('click', () => {
        clearInterval(discountTimerInterval);
        modal.remove();
        openSubscriptionModal();
    });
    
    document.getElementById('engagingBrowseBtn').addEventListener('click', () => {
        clearInterval(discountTimerInterval);
        modal.remove();
        showToast("👀 Browse mode active — you can view profiles but can't like or message until you upgrade", "info");
        disableAllInteractions();
    });
    
    window.closeEngagingModal = function() {
        clearInterval(discountTimerInterval);
        modal.remove();
        showToast("✨ Your matches are waiting! Upgrade anytime to connect with them.", "info");
        disableAllInteractions();
    };
}

function disableAllInteractions() {
    if (window._readOnlyModeActive) return;
    window._readOnlyModeActive = true;
    
    document.querySelectorAll('.like-icon, .admire-icon, .msg-quick-btn, .fp-action-btn.like-btn, .fp-action-btn.admire-btn, .fp-action-btn.msg-btn').forEach(btn => {
        btn.style.opacity = '0.5';
        btn.style.pointerEvents = 'none';
        btn.style.cursor = 'not-allowed';
        btn.title = 'Upgrade to Premium to interact';
    });
    
    const chatInput = document.getElementById('chatInputSection');
    if (chatInput) {
        chatInput.disabled = true;
        chatInput.placeholder = '🔒 Upgrade to send messages';
        chatInput.style.backgroundColor = '#f5f5f5';
        chatInput.style.cursor = 'not-allowed';
    }
    
    const chatSendBtn = document.getElementById('chatSendBtnSection');
    if (chatSendBtn) {
        chatSendBtn.disabled = true;
        chatSendBtn.style.opacity = '0.5';
        chatSendBtn.style.cursor = 'not-allowed';
        chatSendBtn.title = 'Upgrade to send messages';
    }
    
    const mobileChatInput = document.getElementById('chatInput');
    if (mobileChatInput) {
        mobileChatInput.disabled = true;
        mobileChatInput.placeholder = '🔒 Upgrade to send messages';
        mobileChatInput.style.backgroundColor = '#f5f5f5';
        mobileChatInput.style.cursor = 'not-allowed';
    }
    
    const mobileChatSendBtn = document.getElementById('chatSendBtn');
    if (mobileChatSendBtn) {
        mobileChatSendBtn.disabled = true;
        mobileChatSendBtn.style.opacity = '0.5';
        mobileChatSendBtn.style.cursor = 'not-allowed';
        mobileChatSendBtn.title = 'Upgrade to send messages';
    }
    
    const chatMessagesArea = document.getElementById('chatMessagesSection');
    if (chatMessagesArea && !document.getElementById('chatDisabledOverlay')) {
        const overlayMsg = document.createElement('div');
        overlayMsg.id = 'chatDisabledOverlay';
        overlayMsg.style.cssText = `
            text-align: center;
            padding: 12px 16px;
            margin: 8px 16px;
            background: linear-gradient(135deg, #fff5f7, white);
            border-radius: 20px;
            border: 1px solid #ffe2ec;
            font-size: 0.8rem;
            color: #ff4d6d;
        `;
        overlayMsg.innerHTML = `
            <i class="fas fa-lock"></i> 
            <strong>Chat is locked</strong> — Your free session has ended. 
            <button onclick="openSubscriptionModal()" style="background:none; border:none; color:#ff4d6d; font-weight:600; cursor:pointer; text-decoration:underline;">
                Upgrade to continue messaging
            </button>
        `;
        chatMessagesArea.insertBefore(overlayMsg, chatMessagesArea.firstChild);
    }
    
    const mobileChatMessages = document.getElementById('chatMessages');
    if (mobileChatMessages && !document.getElementById('chatDisabledOverlayMobile')) {
        const overlayMsgMobile = document.createElement('div');
        overlayMsgMobile.id = 'chatDisabledOverlayMobile';
        overlayMsgMobile.style.cssText = `
            text-align: center;
            padding: 12px 16px;
            margin: 8px 16px;
            background: linear-gradient(135deg, #fff5f7, white);
            border-radius: 20px;
            border: 1px solid #ffe2ec;
            font-size: 0.8rem;
            color: #ff4d6d;
        `;
        overlayMsgMobile.innerHTML = `
            <i class="fas fa-lock"></i> 
            <strong>Chat is locked</strong> — Your free session has ended. 
            <button onclick="openSubscriptionModal()" style="background:none; border:none; color:#ff4d6d; font-weight:600; cursor:pointer; text-decoration:underline;">
                Upgrade to continue messaging
            </button>
        `;
        mobileChatMessages.insertBefore(overlayMsgMobile, mobileChatMessages.firstChild);
    }
    
    if (!document.getElementById('upgradeReminderBanner')) {
        const banner = document.createElement('div');
        banner.id = 'upgradeReminderBanner';
        banner.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            right: 20px;
            background: linear-gradient(135deg, #1a1a2e, #2a2a3e);
            color: white;
            padding: 12px 20px;
            border-radius: 60px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 12px;
            z-index: 9999;
            box-shadow: 0 8px 24px rgba(0,0,0,0.2);
            backdrop-filter: blur(8px);
            font-size: 0.85rem;
        `;
        banner.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <i class="fas fa-lock" style="color: #ff4d6d;"></i>
                <span><strong>Read-only mode</strong> — You can browse profiles and view messages, but can't like or reply</span>
            </div>
            <button id="upgradeNowBannerBtn" style="
                background: #ff4d6d;
                border: none;
                color: white;
                padding: 6px 18px;
                border-radius: 40px;
                font-weight: 600;
                cursor: pointer;
                font-size: 0.8rem;
            ">Upgrade to Unlock →</button>
        `;
        document.body.appendChild(banner);
        
        document.getElementById('upgradeNowBannerBtn').addEventListener('click', () => {
            openSubscriptionModal();
        });
    }
}

async function openSubscriptionModal() {
    const settings = await getAdminSettings();
    var premiumPrice = (settings.premiumPrice || 19.99).toFixed(2);
    var premiumPlusPrice = (settings.premiumPlusPrice || 29.99).toFixed(2);

    var modal = document.getElementById('subscriptionModal');
    if (modal) {
        var priceEls = modal.querySelectorAll('.price');
        if (priceEls[1]) priceEls[1].innerHTML = '$' + premiumPrice + '<span>/mo</span>';
        if (priceEls[2]) priceEls[2].innerHTML = '$' + premiumPlusPrice + '<span>/mo</span>';
    }
    document.getElementById('subscriptionModal').style.display = 'flex';
}

async function subscribe(plan) {
    await updateDoc(doc(db, 'users', currentUser.id), {
        isPremium: true,
        subscriptionPlan: plan,
        premiumSince: new Date().toISOString()
    });
    
    currentUser.isPremium = true;
    currentUser.subscriptionPlan = plan;
    localStorage.setItem('lovelink_premium', 'true');
    isPremiumUser = true;

    if (timerInterval) clearInterval(timerInterval);
    const tw = document.getElementById('timerWarning');
    if (tw) tw.style.display = 'none';

    const banner = document.getElementById('upgradeReminderBanner');
    if (banner) banner.remove();

    const chatOverlay = document.getElementById('chatDisabledOverlay');
    if (chatOverlay) chatOverlay.remove();
    
    const chatOverlayMobile = document.getElementById('chatDisabledOverlayMobile');
    if (chatOverlayMobile) chatOverlayMobile.remove();

    window._readOnlyModeActive = false;
    
    document.querySelectorAll('.like-icon, .admire-icon, .msg-quick-btn, .fp-action-btn').forEach(btn => {
        btn.style.opacity = '';
        btn.style.pointerEvents = '';
        btn.style.cursor = '';
        btn.disabled = false;
        btn.title = '';
    });
    
    document.querySelectorAll('.like-icon, .admire-icon').forEach(btn => {
        btn.style.pointerEvents = '';
    });
    
    const chatInput = document.getElementById('chatInputSection');
    if (chatInput) {
        chatInput.disabled = false;
        chatInput.placeholder = 'Type a message…';
        chatInput.style.backgroundColor = '';
        chatInput.style.cursor = '';
    }
    
    const chatSendBtn = document.getElementById('chatSendBtnSection');
    if (chatSendBtn) {
        chatSendBtn.disabled = false;
        chatSendBtn.style.opacity = '';
        chatSendBtn.style.cursor = '';
        chatSendBtn.title = '';
    }
    
    const mobileChatInput = document.getElementById('chatInput');
    if (mobileChatInput) {
        mobileChatInput.disabled = false;
        mobileChatInput.placeholder = 'Type a message...';
        mobileChatInput.style.backgroundColor = '';
        mobileChatInput.style.cursor = '';
    }
    
    const mobileChatSendBtn = document.getElementById('chatSendBtn');
    if (mobileChatSendBtn) {
        mobileChatSendBtn.disabled = false;
        mobileChatSendBtn.style.opacity = '';
        mobileChatSendBtn.style.cursor = '';
        mobileChatSendBtn.title = '';
    }
    
    const engagingModal = document.getElementById('engagingUpgradeModal');
    if (engagingModal) engagingModal.remove();

    document.getElementById('subscriptionModal').style.display = 'none';
    showToast(`🎉 Welcome to ${plan === 'premium_plus' ? 'Premium+' : 'Premium'}! Unlimited access unlocked!`, 'success');
}

function showToast(msg, type = 'default') {
    const existing = document.getElementById('ll-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'll-toast';
    let bg = '#ff4d6d';
    if (type === 'warning') bg = '#ff9800';
    else if (type === 'success') bg = '#4caf50';
    else if (type === 'info') bg = '#2196f3';
    
    toast.style.cssText = `position:fixed;bottom:32px;left:50%;transform:translateX(-50%);background:${bg};color:white;padding:14px 28px;border-radius:40px;font-weight:600;z-index:99998;box-shadow:0 8px 24px rgba(0,0,0,0.2);font-size:0.95rem;animation:toastIn 0.3s ease;max-width:90vw;text-align:center;`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

function openReportModal(reportedUserId, reportedName) {
    let existing = document.getElementById('reportUserModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'reportUserModal';
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:460px;border-radius:24px;padding:0;overflow:hidden;">
            <div style="background:linear-gradient(135deg,#ff4d6d,#ff758f);padding:20px 24px;display:flex;align-items:center;justify-content:space-between;">
                <h3 style="color:white;font-size:1.1rem;"><i class="fas fa-flag"></i> Report User</h3>
                <button onclick="document.getElementById('reportUserModal').remove()" style="background:rgba(255,255,255,0.2);border:none;color:white;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:1.1rem;line-height:1;">&times;</button>
            </div>
            <div style="padding:24px;">
                <p style="margin-bottom:16px;color:#555;">Reporting <strong>${escapeHtml(reportedName)}</strong>. Our team will review this within 24 hours.</p>
                <label style="display:block;font-weight:600;margin-bottom:8px;color:#1a1a2e;">Reason for report *</label>
                <select id="reportReason" style="width:100%;padding:12px;border:2px solid #ffe2ec;border-radius:40px;font-family:inherit;margin-bottom:14px;appearance:none;background:white;">
                    <option value="">Select a reason...</option>
                    <option value="Harassment or bullying">Harassment or bullying</option>
                    <option value="Inappropriate content">Inappropriate content</option>
                    <option value="Fake profile / Impersonation">Fake profile / Impersonation</option>
                    <option value="Spam or scam">Spam or scam</option>
                    <option value="Hate speech">Hate speech</option>
                    <option value="Underage user">Underage user</option>
                    <option value="Other">Other</option>
                </select>
                <label style="display:block;font-weight:600;margin-bottom:8px;color:#1a1a2e;">Additional details</label>
                <textarea id="reportDetails" rows="3" placeholder="Describe what happened (optional)..." style="width:100%;padding:12px;border:2px solid #ffe2ec;border-radius:16px;font-family:inherit;resize:none;margin-bottom:20px;"></textarea>
                <div id="reportError" style="display:none;color:#c62828;font-size:0.85rem;margin-bottom:12px;"></div>
                <button onclick="submitReport('${reportedUserId}','${escapeHtml(reportedName)}')" style="width:100%;background:linear-gradient(135deg,#ff4d6d,#ff758f);color:white;border:none;padding:14px;border-radius:40px;font-weight:700;cursor:pointer;font-size:1rem;font-family:inherit;">
                    <i class="fas fa-paper-plane"></i> Submit Report
                </button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

window.openReportModal = openReportModal;

async function submitReport(reportedUserId, reportedName) {
    const reason = document.getElementById('reportReason')?.value;
    const details = document.getElementById('reportDetails')?.value.trim();
    const errEl = document.getElementById('reportError');

    if (!reason) {
        if (errEl) { errEl.textContent = 'Please select a reason.'; errEl.style.display = 'block'; }
        return;
    }

    const reportData = {
        reportedUserId: reportedUserId,
        reportedName: reportedName,
        reporterId: currentUser.id,
        reporterName: currentUser.name,
        reason: reason + (details ? ' — ' + details : ''),
        status: 'pending',
        createdAt: new Date().toISOString()
    };
    
    await addDoc(collection(db, 'reports'), reportData);

    const modal = document.getElementById('reportUserModal');
    if (modal) modal.remove();
    showToast('✅ Report submitted. Our team will review it shortly.', 'success');
}

window.submitReport = submitReport;

// ─── Global exports ───────────────────────────────────────────────────────────
window.viewProfileFullscreen = viewProfileFullscreen;
window.handleLike = handleLike;
window.handleAdmire = handleAdmire;
window.openChat = openChat;
window.subscribe = subscribe;
window.openSubscriptionModal = openSubscriptionModal;
window.chatPollingInterval = chatPollingInterval;