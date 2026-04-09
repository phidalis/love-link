/* admin-dashboard.js — LoveLink Admin Panel (Fixed) */

// ── Auth Guard ───────────────────────────────────────────────────────────────
var adminSession = JSON.parse(localStorage.getItem('lovelink_admin_session') || 'null');
if (!adminSession || !adminSession.loggedIn) {
    window.location.href = 'admin-login.html';
}

// ── Global State ─────────────────────────────────────────────────────────────
var currentPage = 'dashboard';
var allUsers    = [];
var reports     = [];
var adminList   = [];

document.addEventListener('DOMContentLoaded', function () {
    loadData();
    setupNav();
    setupLogout();
    setupGlobalModalClose();
    loadPage('dashboard');
    document.getElementById('adminEmailDisplay').textContent = adminSession.email || 'admin@lovelink.com';
    document.getElementById('adminRoleDisplay').textContent  = formatRole(adminSession.role || 'super_admin');
    updateSidebarContactBadge();  
});

// ── Data Helpers ──────────────────────────────────────────────────────────────
function loadData() {
    allUsers  = JSON.parse(localStorage.getItem('lovelink_users')   || '[]');
    reports   = JSON.parse(localStorage.getItem('lovelink_reports') || '[]');
    adminList = JSON.parse(localStorage.getItem('lovelink_admins')  || '[]');

    if (adminList.length === 0) {
        adminList = [{
            id:        'admin_001',
            email:     'admin@lovelink.com',
            password:  'admin123',
            name:      'Super Admin',
            role:      'super_admin',
            createdAt: new Date().toISOString(),
            active:    true
        }];
        saveAdmins();
    }

    if (!localStorage.getItem('lovelink_admin_settings')) {
        localStorage.setItem('lovelink_admin_settings', JSON.stringify({
            freeMinutes: 5, freeLikes: 5,
            premiumPrice: 19.99, premiumPlusPrice: 29.99,
            features: { admirationEnabled: true, videoDatesEnabled: false, profileBoostEnabled: true }
        }));
    }
}

function saveUsers()  { localStorage.setItem('lovelink_users',   JSON.stringify(allUsers)); }
function saveReports(){ localStorage.setItem('lovelink_reports', JSON.stringify(reports));  }
function saveAdmins() { localStorage.setItem('lovelink_admins',  JSON.stringify(adminList));}

// ── Navigation ────────────────────────────────────────────────────────────────
function setupNav() {
    document.querySelectorAll('.nav-item').forEach(function (item) {
        item.addEventListener('click', function (e) {
            e.preventDefault();
            document.querySelectorAll('.nav-item').forEach(function (n) { n.classList.remove('active'); });
            item.classList.add('active');
            loadPage(item.dataset.page);
        });
    });
}

function setupLogout() {
    document.getElementById('adminLogoutBtn').addEventListener('click', function () {
        localStorage.removeItem('lovelink_admin_session');
        window.location.href = 'admin-login.html';
    });
}

function setupGlobalModalClose() {
    // Close on backdrop click
    window.addEventListener('click', function (e) {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });
    // Event delegation for ALL close-modal buttons (including dynamically created ones)
    document.addEventListener('click', function (e) {
        var btn = e.target.classList.contains('close-modal') ? e.target : e.target.closest('.close-modal');
        if (btn) {
            var modal = btn.closest('.modal');
            if (modal) modal.style.display = 'none';
        }
    });
}

// FIX: explicit if/else instead of object shorthand that caused ReferenceError
function loadPage(page) {
    currentPage = page;
    var titles = {
        dashboard: 'Dashboard',
        users:     'User Management',
        reports:   'Content Reports',
        messages:  'Message Monitor',
        settings:  'System Settings',
        admins:    'Admin Management',
        contacts:  'Contact Messages'   
    };
    document.getElementById('pageTitle').textContent = titles[page] || page;
    loadData();

    if      (page === 'dashboard') renderDashboard();
    else if (page === 'users')     renderUserManagement();
    else if (page === 'reports')   renderReports();
    else if (page === 'messages')  renderMessageMonitoring();
    else if (page === 'settings')  renderSettings();
    else if (page === 'admins')    renderAdminManagement();
    else if (page === 'contacts') {
        renderContactMessages();
        updateSidebarContactBadge();
    }
    else                           renderDashboard();
}

// ════════════════════════════════════════════════════════════════════════════
//  DASHBOARD
// ════════════════════════════════════════════════════════════════════════════
function renderDashboard() {
    var totalUsers     = allUsers.length;
    var premiumUsers   = allUsers.filter(function (u) { return u.isPremium && !u.isBanned && !u.isSuspended; }).length;
    var bannedUsers    = allUsers.filter(function (u) { return u.isBanned; }).length;
    var suspendedUsers = allUsers.filter(function (u) { return u.isSuspended && !u.isBanned; }).length;
    var activeUsers    = allUsers.filter(function (u) {
        var last = new Date(u.lastActive || u.createdAt);
        return (Date.now() - last.getTime()) / 86400000 < 7;
    }).length;
    var newThisWeek  = allUsers.filter(function (u) {
        return (Date.now() - new Date(u.createdAt).getTime()) / 86400000 < 7;
    }).length;
    var settings     = JSON.parse(localStorage.getItem('lovelink_admin_settings') || '{}');
    var revenue      = (premiumUsers * (settings.premiumPrice || 19.99)).toFixed(0);
    var pendingRpts  = reports.filter(function (r) { return r.status !== 'resolved'; }).length;
    var recentUsers  = allUsers.slice().reverse().slice(0, 10);

    var rows = recentUsers.map(function (u) {
        return '<tr>' +
            '<td><div style="display:flex;align-items:center;gap:10px;">' +
                '<img src="' + (u.image || avatarUrl(u.name)) + '" style="width:36px;height:36px;border-radius:50%;object-fit:cover;">' +
                '<div><strong>' + esc(u.name) + '</strong><br><small style="color:#aaa;">' + esc(u.email) + '</small></div>' +
            '</div></td>' +
            '<td>' + userStatusBadge(u) + '</td>' +
            '<td style="color:#888;font-size:0.8rem;">' + fmtDate(u.createdAt) + '</td>' +
            '<td class="action-buttons">' +
                '<button class="action-btn btn-view" onclick="viewUserDetails(\'' + u.id + '\')"><i class="fas fa-eye"></i> View</button>' +
            '</td>' +
        '</tr>';
    }).join('');

    document.getElementById('pageContent').innerHTML =
        '<div class="stats-grid">' +
            statCard('Total Users',      totalUsers,     'fa-users',        '#4361ee') +
            statCard('Premium Members',  premiumUsers,   'fa-crown',        '#f72585') +
            statCard('Active (7d)',       activeUsers,    'fa-chart-line',   '#4cc9f0') +
            statCard('New This Week',     newThisWeek,    'fa-user-plus',    '#7209b7') +
            statCard('Suspended',         suspendedUsers, 'fa-pause-circle', '#f4a261') +
            statCard('Banned',            bannedUsers,    'fa-ban',          '#e63946') +
            statCard('Pending Reports',   pendingRpts,    'fa-flag',         '#ff6b6b') +
            statCard('Est. Revenue',      '$' + Number(revenue).toLocaleString(), 'fa-dollar-sign', '#2dc653') +
        '</div>' +
        '<div class="charts-row">' +
            '<div class="chart-card"><h3><i class="fas fa-chart-area"></i> User Growth (7 Days)</h3><canvas id="userGrowthChart" height="120"></canvas></div>' +
            '<div class="chart-card"><h3><i class="fas fa-chart-pie"></i> User Breakdown</h3><canvas id="breakdownChart" height="120"></canvas></div>' +
        '</div>' +
        '<div class="table-container">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;padding:20px 20px 0;">' +
                '<h3>Recent Registrations</h3>' +
                '<span style="font-size:0.8rem;color:#aaa;">' + totalUsers + ' total users</span>' +
            '</div>' +
            '<table class="data-table"><thead><tr><th>User</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>' +
            '<tbody>' + (rows || '<tr><td colspan="4" style="text-align:center;padding:30px;color:#aaa;">No users yet</td></tr>') + '</tbody></table>' +
        '</div>';

    setTimeout(function () { drawGrowthChart(); drawBreakdownChart(); }, 100);
}

function statCard(label, value, icon, color) {
    return '<div class="stat-card" style="border-left:4px solid ' + color + ';">' +
        '<div class="stat-info"><h3>' + label + '</h3><div class="stat-number">' + value + '</div></div>' +
        '<div class="stat-icon" style="background:' + color + '18;"><i class="fas ' + icon + '" style="color:' + color + ';font-size:1.4rem;"></i></div>' +
    '</div>';
}

function drawGrowthChart() {
    var canvas = document.getElementById('userGrowthChart');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var labels = [], data = [];
    for (var i = 6; i >= 0; i--) {
        var d = new Date();
        d.setDate(d.getDate() - i);
        labels.push(d.toLocaleDateString('en', { weekday: 'short' }));
        var dayStr = d.toDateString();
        data.push(allUsers.filter(function (u) {
            return new Date(u.createdAt).toDateString() === dayStr;
        }).length);
    }
    new Chart(ctx, {
        type: 'line',
        data: { labels: labels, datasets: [{ label: 'Signups', data: data, borderColor: '#ff4d6d', backgroundColor: 'rgba(255,77,109,0.1)', tension: 0.4, fill: true, pointBackgroundColor: '#ff4d6d' }] },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
    });
}

function drawBreakdownChart() {
    var canvas = document.getElementById('breakdownChart');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var premium   = allUsers.filter(function (u) { return u.isPremium && !u.isBanned && !u.isSuspended; }).length;
    var free      = allUsers.filter(function (u) { return !u.isPremium && !u.isBanned && !u.isSuspended; }).length;
    var suspended = allUsers.filter(function (u) { return u.isSuspended && !u.isBanned; }).length;
    var banned    = allUsers.filter(function (u) { return u.isBanned; }).length;
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Premium', 'Free', 'Suspended', 'Banned'],
            datasets: [{ data: [premium, free, suspended, banned], backgroundColor: ['#ff4d6d', '#4361ee', '#f4a261', '#e63946'], borderWidth: 0 }]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });
}

// ════════════════════════════════════════════════════════════════════════════
//  USER MANAGEMENT
// ════════════════════════════════════════════════════════════════════════════
function renderUserManagement() {
    document.getElementById('pageContent').innerHTML =
        '<div class="search-bar">' +
            '<input type="text" id="userSearch" class="search-input" placeholder="Search name or email...">' +
            '<select id="userFilter" class="filter-select">' +
                '<option value="all">All Users</option>' +
                '<option value="premium">Premium</option>' +
                '<option value="free">Free</option>' +
                '<option value="suspended">Suspended</option>' +
                '<option value="banned">Banned</option>' +
            '</select>' +
            '<select id="userSort" class="filter-select">' +
                '<option value="newest">Newest First</option>' +
                '<option value="oldest">Oldest First</option>' +
                '<option value="name">Name A-Z</option>' +
            '</select>' +
        '</div>' +
        '<div class="table-container">' +
            '<table class="data-table">' +
                '<thead><tr><th>User</th><th>Plan</th><th>Location</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>' +
                '<tbody id="usersTableBody"></tbody>' +
            '</table>' +
        '</div>';

    renderUsersTable();
    document.getElementById('userSearch').addEventListener('input', renderUsersTable);
    document.getElementById('userFilter').addEventListener('change', renderUsersTable);
    document.getElementById('userSort').addEventListener('change', renderUsersTable);
}

function renderUsersTable() {
    var searchEl = document.getElementById('userSearch');
    var filterEl = document.getElementById('userFilter');
    var sortEl   = document.getElementById('userSort');
    var tbody    = document.getElementById('usersTableBody');
    if (!tbody) return;

    var q      = searchEl ? searchEl.value.toLowerCase() : '';
    var filter = filterEl ? filterEl.value : 'all';
    var sort   = sortEl   ? sortEl.value   : 'newest';

    var list = allUsers.filter(function (u) {
        var matchQ = u.name.toLowerCase().indexOf(q) !== -1 || u.email.toLowerCase().indexOf(q) !== -1;
        if (!matchQ) return false;
        if (filter === 'premium')   return u.isPremium  && !u.isBanned && !u.isSuspended;
        if (filter === 'free')      return !u.isPremium && !u.isBanned && !u.isSuspended;
        if (filter === 'suspended') return !!u.isSuspended;
        if (filter === 'banned')    return !!u.isBanned;
        return true;
    });

    if (sort === 'newest') list.sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
    if (sort === 'oldest') list.sort(function (a, b) { return new Date(a.createdAt) - new Date(b.createdAt); });
    if (sort === 'name')   list.sort(function (a, b) { return a.name.localeCompare(b.name); });

    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:#aaa;">No users found</td></tr>';
        return;
    }

    tbody.innerHTML = list.map(function (u) {
        var borderColor = u.isBanned ? '#e63946' : u.isSuspended ? '#f4a261' : u.isPremium ? '#ff4d6d' : '#e0e0e0';
        var crown = u.isPremium ? '<span style="position:absolute;bottom:-2px;right:-2px;background:#ff4d6d;color:white;font-size:8px;border-radius:50%;width:15px;height:15px;display:flex;align-items:center;justify-content:center;"><i class="fas fa-crown"></i></span>' : '';
        var planText = u.isPremium
            ? '<span style="color:#ff4d6d;font-weight:600;"><i class="fas fa-crown"></i> ' + (u.subscriptionPlan === 'premium_plus' ? 'Premium+' : 'Premium') + '</span>'
            : '<span style="color:#888;">Free</span>';
        return '<tr>' +
            '<td><div style="display:flex;align-items:center;gap:10px;">' +
                '<div style="position:relative;"><img src="' + (u.image || avatarUrl(u.name)) + '" style="width:42px;height:42px;border-radius:50%;object-fit:cover;border:2px solid ' + borderColor + ';">' + crown + '</div>' +
                '<div><strong>' + esc(u.name) + '</strong><br><small style="color:#aaa;">' + esc(u.email) + '</small></div>' +
            '</div></td>' +
            '<td>' + planText + '</td>' +
            '<td style="color:#888;font-size:0.85rem;">' + esc(u.city || u.country || 'N/A') + '</td>' +
            '<td>' + userStatusBadge(u) + '</td>' +
            '<td style="color:#888;font-size:0.8rem;">' + fmtDate(u.createdAt) + '</td>' +
            '<td class="action-buttons">' +
                '<button class="action-btn btn-view" onclick="viewUserDetails(\'' + u.id + '\')"><i class="fas fa-eye"></i> View</button>' +
                actionButton(u) +
                '<button class="action-btn btn-delete" onclick="deleteUser(\'' + u.id + '\')"><i class="fas fa-trash"></i></button>' +
            '</td>' +
        '</tr>';
    }).join('');
}

function userStatusBadge(u) {
    if (u.isBanned)    return '<span class="status-badge status-banned"><i class="fas fa-ban"></i> Banned</span>';
    if (u.isSuspended) return '<span class="status-badge status-suspended"><i class="fas fa-pause-circle"></i> Suspended</span>';
    if (u.isPremium)   return '<span class="status-badge status-active"><i class="fas fa-crown"></i> Premium</span>';
    return '<span class="status-badge status-inactive">Free</span>';
}

function actionButton(u) {
    if (u.isBanned) {
        return '<button class="action-btn btn-view" onclick="unbanUser(\'' + u.id + '\')"><i class="fas fa-undo"></i> Unban</button>';
    }
    if (u.isSuspended) {
        return '<button class="action-btn btn-ban" onclick="unsuspendUser(\'' + u.id + '\')"><i class="fas fa-play"></i> Unsuspend</button>' +
               '<button class="action-btn btn-delete" onclick="banUser(\'' + u.id + '\')"><i class="fas fa-ban"></i> Ban</button>';
    }
    return '<button class="action-btn btn-ban" onclick="openSuspendModal(\'' + u.id + '\')"><i class="fas fa-pause"></i> Suspend</button>' +
           '<button class="action-btn btn-delete" onclick="banUser(\'' + u.id + '\')"><i class="fas fa-ban"></i> Ban</button>';
}

// ── Suspend Modal ─────────────────────────────────────────────────────────────
function openSuspendModal(userId) {
    var user = allUsers.find(function (u) { return u.id === userId; });
    if (!user) return;

    var modal = document.getElementById('suspendModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id        = 'suspendModal';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }
    modal.innerHTML =
        '<div class="modal-content" style="max-width:480px;">' +
            '<div class="modal-header">' +
                '<h3><i class="fas fa-pause-circle" style="color:#f4a261;"></i> Suspend User</h3>' +
                '<button class="close-modal" onclick="document.getElementById(\'suspendModal\').style.display=\'none\'">&times;</button>' +
            '</div>' +
            '<div style="padding:24px;">' +
                '<p style="margin-bottom:16px;">Suspending <strong>' + esc(user.name) + '</strong>. They will be blocked from logging in.</p>' +
                '<label style="font-weight:600;display:block;margin-bottom:8px;">Duration</label>' +
                '<select id="suspendDuration" style="width:100%;padding:10px;border:2px solid #eee;border-radius:12px;font-family:inherit;margin-bottom:16px;">' +
                    '<option value="1">1 Day</option>' +
                    '<option value="3">3 Days</option>' +
                    '<option value="7" selected>7 Days</option>' +
                    '<option value="30">30 Days</option>' +
                    '<option value="0">Indefinite</option>' +
                '</select>' +
                '<label style="font-weight:600;display:block;margin-bottom:8px;">Reason</label>' +
                '<textarea id="suspendReason" rows="3" style="width:100%;padding:10px;border:2px solid #eee;border-radius:12px;resize:none;font-family:inherit;margin-bottom:20px;" placeholder="Reason for suspension..."></textarea>' +
                '<div style="display:flex;gap:10px;">' +
                    '<button class="save-settings-btn" style="background:#f4a261;flex:1;" onclick="confirmSuspend(\'' + userId + '\')"><i class="fas fa-pause-circle"></i> Confirm Suspension</button>' +
                    '<button class="save-settings-btn" style="background:#888;" onclick="document.getElementById(\'suspendModal\').style.display=\'none\'">Cancel</button>' +
                '</div>' +
            '</div>' +
        '</div>';
    modal.style.display = 'flex';
}

function confirmSuspend(userId) {
    var durEl    = document.getElementById('suspendDuration');
    var reasonEl = document.getElementById('suspendReason');
    var days     = durEl    ? parseInt(durEl.value)    : 7;
    var reason   = reasonEl ? reasonEl.value.trim()    : '';
    var idx      = allUsers.findIndex(function (u) { return u.id === userId; });
    if (idx === -1) return;

    allUsers[idx].isSuspended    = true;
    allUsers[idx].suspendedAt    = new Date().toISOString();
    allUsers[idx].suspendReason  = reason || 'Policy violation';
    allUsers[idx].suspendedUntil = days > 0
        ? new Date(Date.now() + days * 86400000).toISOString()
        : null;

    // Force-logout if currently active
    if (localStorage.getItem('lovelink_current_user_id') === userId) {
        localStorage.removeItem('lovelink_current_user_id');
        localStorage.removeItem('lovelink_premium');
    }

    saveUsers();
    document.getElementById('suspendModal').style.display = 'none';
    showToast(allUsers[idx].name + ' has been suspended', 'warning');
    if (currentPage === 'users') renderUsersTable();
    else if (currentPage === 'dashboard') renderDashboard();
}

function unsuspendUser(userId) {
    var idx = allUsers.findIndex(function (u) { return u.id === userId; });
    if (idx === -1) return;
    allUsers[idx].isSuspended    = false;
    allUsers[idx].suspendedUntil = null;
    allUsers[idx].suspendReason  = null;
    saveUsers();
    showToast(allUsers[idx].name + ' has been unsuspended', 'success');
    if (currentPage === 'users') renderUsersTable();
    else if (currentPage === 'dashboard') renderDashboard();
}

function banUser(userId) {
    if (!confirm('Ban this user? They will be permanently blocked from logging in.')) return;
    var idx = allUsers.findIndex(function (u) { return u.id === userId; });
    if (idx === -1) return;
    allUsers[idx].isBanned    = true;
    allUsers[idx].isSuspended = false;
    allUsers[idx].bannedAt    = new Date().toISOString();
    if (localStorage.getItem('lovelink_current_user_id') === userId) {
        localStorage.removeItem('lovelink_current_user_id');
        localStorage.removeItem('lovelink_premium');
    }
    saveUsers();
    showToast(allUsers[idx].name + ' has been banned', 'error');
    if (currentPage === 'users') renderUsersTable();
    else if (currentPage === 'dashboard') renderDashboard();
}

function unbanUser(userId) {
    if (!confirm('Unban this user?')) return;
    var idx = allUsers.findIndex(function (u) { return u.id === userId; });
    if (idx === -1) return;
    allUsers[idx].isBanned = false;
    allUsers[idx].bannedAt = null;
    saveUsers();
    showToast(allUsers[idx].name + ' has been unbanned', 'success');
    if (currentPage === 'users') renderUsersTable();
    else if (currentPage === 'dashboard') renderDashboard();
}

function deleteUser(userId) {
    if (!confirm('Permanently delete this user and all their data? This cannot be undone.')) return;
    var user = allUsers.find(function (u) { return u.id === userId; });
    var name = user ? user.name : 'User';
    allUsers = allUsers.filter(function (u) { return u.id !== userId; });
    saveUsers();
    var msgs = JSON.parse(localStorage.getItem('lovelink_messages') || '{}');
    Object.keys(msgs).forEach(function (k) {
        var parts = k.split('__');
        if (parts[0] === userId || parts[1] === userId) delete msgs[k];
    });
    localStorage.setItem('lovelink_messages', JSON.stringify(msgs));
    showToast(name + ' permanently deleted', 'error');
    if (currentPage === 'users') renderUsersTable();
    else if (currentPage === 'dashboard') renderDashboard();
}

// ── User Detail Modal ─────────────────────────────────────────────────────────
function viewUserDetails(userId) {
    var user = allUsers.find(function (u) { return u.id === userId; });
    if (!user) return;

    var msgs = JSON.parse(localStorage.getItem('lovelink_messages') || '{}');
    // FIX: exact segment match to avoid partial ID collisions
    var convos = Object.keys(msgs).filter(function (k) {
        var parts = k.split('__');
        return parts[0] === userId || parts[1] === userId;
    }).map(function (k) {
        var parts   = k.split('__');
        var otherId = parts[0] === userId ? parts[1] : parts[0];
        return {
            key:      k,
            other:    allUsers.find(function (u) { return u.id === otherId; }),
            messages: msgs[k]
        };
    });

    var suspendInfo = user.isSuspended
        ? '<p style="color:#f4a261;font-size:0.85rem;margin-top:4px;"><i class="fas fa-info-circle"></i> Suspended: ' +
          esc(user.suspendReason || '') +
          (user.suspendedUntil ? ' until ' + fmtDate(user.suspendedUntil) : ' (indefinite)') + '</p>'
        : '';

    var convoHtml = convos.length === 0
        ? '<div style="text-align:center;padding:40px;color:#aaa;background:#f8f9fa;border-radius:16px;">No conversations found</div>'
        : convos.map(function (conv) {
            var otherImg  = conv.other && conv.other.image ? conv.other.image : avatarUrl(conv.other ? conv.other.name : '?');
            var otherName = conv.other ? esc(conv.other.name) : 'Unknown';
            var msgHtml   = conv.messages.map(function (msg, idx) {
                var senderName = msg.senderId === userId ? esc(user.name) : otherName;
                return '<div class="chat-message-item">' +
                    '<div class="chat-message-content">' +
                        '<div class="chat-message-sender">' + senderName + '</div>' +
                        '<div class="chat-message-text">' + esc(msg.text) + '</div>' +
                        '<div class="chat-message-time">' + new Date(msg.timestamp).toLocaleString() + '</div>' +
                    '</div>' +
                    '<button class="delete-msg-btn" onclick="adminDeleteMessage(\'' + conv.key + '\',' + idx + ',\'' + userId + '\')"><i class="fas fa-trash"></i></button>' +
                '</div>';
            }).join('');
            return '<div style="margin-bottom:24px;background:#f8f9fa;border-radius:16px;overflow:hidden;">' +
                '<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:#fff;border-bottom:1px solid #eef2f6;">' +
                    '<div style="display:flex;align-items:center;gap:10px;">' +
                        '<img src="' + otherImg + '" style="width:36px;height:36px;border-radius:50%;object-fit:cover;">' +
                        '<div><strong>' + otherName + '</strong><div style="font-size:0.75rem;color:#aaa;">' + conv.messages.length + ' messages</div></div>' +
                    '</div>' +
                    '<button class="action-btn btn-delete" onclick="deleteEntireChat(\'' + conv.key + '\',\'' + userId + '\')"><i class="fas fa-trash-alt"></i> Delete Chat</button>' +
                '</div>' +
                '<div style="padding:12px;max-height:300px;overflow-y:auto;">' + msgHtml + '</div>' +
            '</div>';
        }).join('');

    document.getElementById('userDetailsContent').innerHTML =
        '<div style="padding:24px;">' +
            '<div style="display:flex;gap:20px;align-items:flex-start;margin-bottom:24px;padding-bottom:20px;border-bottom:1px solid #eef2f6;flex-wrap:wrap;">' +
                '<img src="' + (user.image || avatarUrl(user.name)) + '" style="width:90px;height:90px;border-radius:20px;object-fit:cover;">' +
                '<div style="flex:1;min-width:200px;">' +
                    '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px;">' +
                        '<h3 style="font-size:1.2rem;">' + esc(user.name) + '</h3>' +
                        userStatusBadge(user) +
                        (user.isPremium ? '<span class="status-badge status-active"><i class="fas fa-crown"></i> Premium</span>' : '') +
                    '</div>' +
                    '<p style="color:#888;margin-bottom:3px;"><i class="fas fa-envelope"></i> ' + esc(user.email) + '</p>' +
                    '<p style="color:#888;margin-bottom:3px;"><i class="fas fa-map-marker-alt"></i> ' + esc(user.city || user.country || 'N/A') + '</p>' +
                    '<p style="color:#888;margin-bottom:3px;"><i class="fas fa-calendar"></i> Joined ' + fmtDate(user.createdAt) + '</p>' +
                    '<div style="display:flex;align-items:center;gap:8px;margin-top:6px;flex-wrap:wrap;">' +
                        '<span style="font-size:0.82rem;color:#aaa;"><i class="fas fa-key"></i> Password:</span>' +
                        '<code id="pwDisplay_' + user.id + '" style="background:#f0f0f0;padding:3px 10px;border-radius:8px;font-size:0.82rem;letter-spacing:2px;">••••••••</code>' +
                        '<button onclick="togglePwDisplay(\'' + user.id + '\',\'' + esc(user.password || '') + '\')" style="background:#e3f2fd;border:none;color:#1976d2;padding:3px 10px;border-radius:8px;cursor:pointer;font-size:0.78rem;"><i class="fas fa-eye"></i> Show</button>' +
                        '<button onclick="resetUserPassword(\'' + user.id + '\')" style="background:#fff3e0;border:none;color:#f57c00;padding:3px 10px;border-radius:8px;cursor:pointer;font-size:0.78rem;"><i class="fas fa-redo"></i> Reset to 123456</button>' +
                    '</div>' +
                    suspendInfo +
                '</div>' +
                '<div style="display:flex;flex-direction:column;gap:8px;">' + actionButton(user) + '</div>' +
            '</div>' +
            '<h4 style="margin-bottom:16px;"><i class="fas fa-comments" style="color:#ff4d6d;"></i> Chat History (' + convos.length + ' conversations)</h4>' +
            convoHtml +
        '</div>';

    document.getElementById('userDetailsModal').style.display = 'flex';
}

function adminDeleteMessage(convoKey, msgIdx, viewingUserId) {
    if (!confirm('Delete this message?')) return;
    var msgs = JSON.parse(localStorage.getItem('lovelink_messages') || '{}');
    if (msgs[convoKey]) {
        msgs[convoKey].splice(msgIdx, 1);
        if (msgs[convoKey].length === 0) delete msgs[convoKey];
        localStorage.setItem('lovelink_messages', JSON.stringify(msgs));
        viewUserDetails(viewingUserId);
        showToast('Message deleted', 'success');
    }
}

function deleteEntireChat(convoKey, viewingUserId) {
    if (!confirm('Delete this entire conversation? This cannot be undone.')) return;
    var msgs = JSON.parse(localStorage.getItem('lovelink_messages') || '{}');
    delete msgs[convoKey];
    localStorage.setItem('lovelink_messages', JSON.stringify(msgs));
    viewUserDetails(viewingUserId);
    showToast('Conversation deleted', 'error');
}

// ════════════════════════════════════════════════════════════════════════════
//  CONTENT REPORTS
// ════════════════════════════════════════════════════════════════════════════
function renderReports() {
    document.getElementById('pageContent').innerHTML =
        '<div class="search-bar">' +
            '<input type="text" id="rptSearch" class="search-input" placeholder="Search reports...">' +
            '<select id="rptFilter" class="filter-select">' +
                '<option value="all">All</option>' +
                '<option value="pending">Pending</option>' +
                '<option value="resolved">Resolved</option>' +
            '</select>' +
        '</div>' +
        '<div class="table-container">' +
            '<table class="data-table">' +
                '<thead><tr><th>Reported User</th><th>Reported By</th><th>Reason</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead>' +
                '<tbody id="reportsBody"></tbody>' +
            '</table>' +
        '</div>';

    renderReportsTable();
    document.getElementById('rptSearch').addEventListener('input', renderReportsTable);
    document.getElementById('rptFilter').addEventListener('change', renderReportsTable);
}

function renderReportsTable() {
    var rptSearch = document.getElementById('rptSearch');
    var rptFilter = document.getElementById('rptFilter');
    var tbody     = document.getElementById('reportsBody');
    if (!tbody) return;

    var q      = rptSearch ? rptSearch.value.toLowerCase() : '';
    var filter = rptFilter ? rptFilter.value : 'all';

    var list = reports.filter(function (r) {
        var ru     = allUsers.find(function (u) { return u.id === r.reportedUserId; });
        var matchQ = (ru && ru.name ? ru.name.toLowerCase().indexOf(q) !== -1 : false) ||
                     (r.reason || '').toLowerCase().indexOf(q) !== -1;
        var status = r.status || 'pending';
        var matchF = filter === 'all' || status === filter;
        return matchQ && matchF;
    });

    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:#aaa;">No reports found</td></tr>';
        return;
    }

    tbody.innerHTML = list.map(function (r) {
        var ru     = allUsers.find(function (u) { return u.id === r.reportedUserId; });
        var by     = allUsers.find(function (u) { return u.id === r.reporterId; });
        var status = r.status || 'pending';
        var resolveBtn = status !== 'resolved'
            ? '<button class="action-btn btn-view" onclick="resolveReport(\'' + r.id + '\')"><i class="fas fa-check"></i> Resolve</button>'
            : '';
        return '<tr>' +
            '<td><div style="display:flex;align-items:center;gap:8px;">' +
                '<img src="' + (ru && ru.image ? ru.image : avatarUrl(ru ? ru.name : '?')) + '" style="width:34px;height:34px;border-radius:50%;object-fit:cover;">' +
                '<div><strong>' + esc(ru ? ru.name : 'Unknown') + '</strong><br><small style="color:#aaa;">' + esc(ru ? ru.email : 'N/A') + '</small></div>' +
            '</div></td>' +
            '<td>' + esc(by ? by.name : 'Anonymous') + '</td>' +
            '<td style="max-width:220px;">' + esc(r.reason || '') + '</td>' +
            '<td style="color:#888;font-size:0.8rem;">' + fmtDate(r.createdAt) + '</td>' +
            '<td><span class="status-badge ' + (status === 'resolved' ? 'status-active' : 'status-inactive') + '">' + status + '</span></td>' +
            '<td class="action-buttons">' +
                '<button class="action-btn btn-view" onclick="viewUserDetails(\'' + r.reportedUserId + '\')"><i class="fas fa-eye"></i> View</button>' +
                '<button class="action-btn btn-ban" onclick="banFromReport(\'' + r.reportedUserId + '\',\'' + r.id + '\')"><i class="fas fa-ban"></i> Ban</button>' +
                resolveBtn +
            '</td>' +
        '</tr>';
    }).join('');
}

function resolveReport(reportId) {
    var idx = reports.findIndex(function (r) { return r.id === reportId; });
    if (idx !== -1) {
        reports[idx].status = 'resolved';
        saveReports();
        renderReportsTable();
        showToast('Report resolved', 'success');
    }
}

function banFromReport(userId, reportId) {
    banUser(userId);
    resolveReport(reportId);
}

// ════════════════════════════════════════════════════════════════════════════
//  MESSAGE MONITOR
// ════════════════════════════════════════════════════════════════════════════
function renderMessageMonitoring() {
    var msgs = JSON.parse(localStorage.getItem('lovelink_messages') || '{}');
    var convos = Object.keys(msgs).map(function (k) {
        var parts = k.split('__');
        var u1    = allUsers.find(function (u) { return u.id === parts[0]; });
        var u2    = allUsers.find(function (u) { return u.id === parts[1]; });
        var list  = msgs[k];
        return { key: k, user1: u1, user2: u2, messages: list, lastMsg: list[list.length - 1] };
    }).filter(function (c) {
        return c.messages && c.messages.length > 0;
    }).sort(function (a, b) {
        var ta = a.lastMsg ? new Date(a.lastMsg.timestamp).getTime() : 0;
        var tb = b.lastMsg ? new Date(b.lastMsg.timestamp).getTime() : 0;
        return tb - ta;
    });

    var cardsHtml = convos.length === 0
        ? '<div style="text-align:center;padding:60px;background:white;border-radius:20px;color:#aaa;"><i class="fas fa-comment-slash" style="font-size:3rem;display:block;margin-bottom:12px;"></i>No conversations yet</div>'
        : convos.map(function (c) {
            var u1name  = c.user1 ? c.user1.name : 'Unknown';
            var u2name  = c.user2 ? c.user2.name : 'Unknown';
            var u1img   = c.user1 && c.user1.image ? c.user1.image : avatarUrl(u1name);
            var u2img   = c.user2 && c.user2.image ? c.user2.image : avatarUrl(u2name);
            var preview = c.lastMsg ? esc(c.lastMsg.text.substring(0, 80)) : '';
            var timeStr = c.lastMsg ? new Date(c.lastMsg.timestamp).toLocaleString() : '';
            var namesLC = (u1name + u2name).toLowerCase();
            return '<div class="convo-card" data-names="' + namesLC + '" style="background:white;border-radius:16px;padding:16px;border:1px solid #eef2f6;transition:all 0.2s;" onclick="viewConversationModal(\'' + c.key + '\')" style="cursor:pointer;">' +
                '<div style="display:flex;align-items:center;gap:14px;">' +
                    '<div style="position:relative;flex-shrink:0;">' +
                        '<img src="' + u1img + '" style="width:50px;height:50px;border-radius:50%;object-fit:cover;">' +
                        '<img src="' + u2img + '" style="width:34px;height:34px;border-radius:50%;object-fit:cover;position:absolute;bottom:-4px;right:-8px;border:2px solid white;">' +
                    '</div>' +
                    '<div style="flex:1;min-width:0;">' +
                        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">' +
                            '<strong>' + esc(u1name) + ' &harr; ' + esc(u2name) + '</strong>' +
                            '<span style="font-size:0.72rem;color:#bbb;flex-shrink:0;margin-left:8px;">' + timeStr + '</span>' +
                        '</div>' +
                        '<div style="font-size:0.8rem;color:#aaa;margin-bottom:6px;"><i class="fas fa-comment"></i> ' + c.messages.length + ' messages</div>' +
                        '<div style="font-size:0.82rem;color:#666;background:#f8f9fa;padding:5px 12px;border-radius:20px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + preview + '</div>' +
                    '</div>' +
                    '<button class="action-btn btn-delete" onclick="event.stopPropagation();deleteEntireChatGlobal(\'' + c.key + '\',false)" style="flex-shrink:0;"><i class="fas fa-trash-alt"></i> Delete</button>' +
                '</div>' +
            '</div>';
        }).join('');

    document.getElementById('pageContent').innerHTML =
        '<div class="search-bar">' +
            '<input type="text" id="msgSearch" class="search-input" placeholder="Search by user name...">' +
        '</div>' +
        '<div id="convosContainer" style="display:flex;flex-direction:column;gap:12px;">' + cardsHtml + '</div>';

    var searchInput = document.getElementById('msgSearch');
    if (searchInput) {
        searchInput.addEventListener('input', function (e) {
            var q = e.target.value.toLowerCase();
            document.querySelectorAll('.convo-card').forEach(function (card) {
                card.style.display = card.dataset.names.indexOf(q) !== -1 ? '' : 'none';
            });
        });
    }
}

function viewConversationModal(convoKey) {
    var msgs      = JSON.parse(localStorage.getItem('lovelink_messages') || '{}');
    var convoMsgs = msgs[convoKey] || [];
    var parts     = convoKey.split('__');
    var u1        = allUsers.find(function (u) { return u.id === parts[0]; });
    var u2        = allUsers.find(function (u) { return u.id === parts[1]; });
    var title     = esc(u1 ? u1.name : '?') + ' &harr; ' + esc(u2 ? u2.name : '?');

    var msgHtml = convoMsgs.length === 0
        ? '<p style="text-align:center;color:#aaa;padding:40px;">No messages</p>'
        : convoMsgs.map(function (msg, idx) {
            var sender = allUsers.find(function (u) { return u.id === msg.senderId; });
            return '<div class="chat-message-item">' +
                '<div class="chat-message-content">' +
                    '<div class="chat-message-sender">' + esc(sender ? sender.name : 'Unknown') + '</div>' +
                    '<div class="chat-message-text">' + esc(msg.text) + '</div>' +
                    '<div class="chat-message-time">' + new Date(msg.timestamp).toLocaleString() + '</div>' +
                '</div>' +
                '<button class="delete-msg-btn" onclick="deleteMsgFromModal(\'' + convoKey + '\',' + idx + ')"><i class="fas fa-trash"></i></button>' +
            '</div>';
        }).join('');

    var modal = document.getElementById('chatViewModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id        = 'chatViewModal';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }
    modal.innerHTML =
        '<div class="modal-content modal-large">' +
            '<div class="modal-header">' +
                '<h3><i class="fas fa-comments" style="color:#ff4d6d;"></i> ' + title + '</h3>' +
                '<button class="close-modal" onclick="document.getElementById(\'chatViewModal\').style.display=\'none\'">&times;</button>' +
            '</div>' +
            '<div style="padding:20px;">' +
                '<div style="max-height:60vh;overflow-y:auto;">' + msgHtml + '</div>' +
                '<div style="margin-top:16px;display:flex;justify-content:flex-end;">' +
                    '<button class="action-btn btn-delete" onclick="deleteEntireChatGlobal(\'' + convoKey + '\',true)"><i class="fas fa-trash-alt"></i> Delete Entire Chat</button>' +
                '</div>' +
            '</div>' +
        '</div>';
    modal.style.display = 'flex';
}

function deleteMsgFromModal(convoKey, idx) {
    if (!confirm('Delete this message?')) return;
    var msgs = JSON.parse(localStorage.getItem('lovelink_messages') || '{}');
    if (msgs[convoKey]) {
        msgs[convoKey].splice(idx, 1);
        if (msgs[convoKey].length === 0) delete msgs[convoKey];
        localStorage.setItem('lovelink_messages', JSON.stringify(msgs));
        viewConversationModal(convoKey);
        showToast('Message deleted', 'success');
    }
}

function deleteEntireChatGlobal(convoKey, fromModal) {
    if (!confirm('Delete this entire conversation permanently?')) return;
    var msgs = JSON.parse(localStorage.getItem('lovelink_messages') || '{}');
    delete msgs[convoKey];
    localStorage.setItem('lovelink_messages', JSON.stringify(msgs));
    if (fromModal) {
        var m = document.getElementById('chatViewModal');
        if (m) m.style.display = 'none';
    }
    renderMessageMonitoring();
    showToast('Chat deleted', 'error');
}

// ════════════════════════════════════════════════════════════════════════════
//  SYSTEM SETTINGS
// ════════════════════════════════════════════════════════════════════════════
function renderSettings() {
    var s = JSON.parse(localStorage.getItem('lovelink_admin_settings') || '{}');
    var f = s.features || {};
    document.getElementById('pageContent').innerHTML =
        '<div class="settings-section">' +
            '<h3><i class="fas fa-clock"></i> Free Tier Limits</h3>' +
            '<div class="settings-group"><label>Daily Free Minutes</label><input type="number" id="freeMinutes" value="' + (s.freeMinutes || 5) + '" min="1" max="60"></div>' +
            '<div class="settings-group"><label>Daily Free Likes</label><input type="number" id="freeLikes" value="' + (s.freeLikes || 5) + '" min="1" max="50"></div>' +
            '<button class="save-settings-btn" onclick="saveFreeLimits()"><i class="fas fa-save"></i> Save Limits</button>' +
        '</div>' +
        '<div class="settings-section">' +
            '<h3><i class="fas fa-dollar-sign"></i> Premium Pricing</h3>' +
            '<div class="settings-group"><label>Premium Price ($/mo)</label><input type="number" id="premiumPrice" value="' + (s.premiumPrice || 19.99) + '" step="0.01" min="0"></div>' +
            '<div class="settings-group"><label>Premium+ Price ($/mo)</label><input type="number" id="premiumPlusPrice" value="' + (s.premiumPlusPrice || 29.99) + '" step="0.01" min="0"></div>' +
            '<button class="save-settings-btn" onclick="savePremiumPrices()"><i class="fas fa-save"></i> Save Prices</button>' +
        '</div>' +
        '<div class="settings-section">' +
            '<h3><i class="fas fa-toggle-on"></i> Feature Toggles</h3>' +
            toggleRow('admirationEnabled',  'Admiration Feature',  f.admirationEnabled  !== false) +
            toggleRow('videoDatesEnabled',   'Video Dates',         !!f.videoDatesEnabled) +
            toggleRow('profileBoostEnabled', 'Profile Boost',       f.profileBoostEnabled !== false) +
            '<button class="save-settings-btn" style="margin-top:16px;" onclick="saveFeatureToggles()"><i class="fas fa-save"></i> Save Features</button>' +
        '</div>' +
        '<div class="settings-section" style="border:2px solid #ffe0e0;">' +
            '<h3 style="color:#e63946;"><i class="fas fa-exclamation-triangle"></i> Danger Zone</h3>' +
            '<div class="settings-group"><label>Clear All Users</label><button class="save-settings-btn" style="background:#e63946;" onclick="clearAllUsers()"><i class="fas fa-trash-alt"></i> Reset All Users</button></div>' +
            '<div class="settings-group"><label>Clear All Messages</label><button class="save-settings-btn" style="background:#e63946;" onclick="clearAllMessages()"><i class="fas fa-comment-slash"></i> Clear All Chats</button></div>' +
        '</div>';
}



// ════════════════════════════════════════════════════════════════════════════
//  CONTACT MESSAGES - FIXED VERSION
// ════════════════════════════════════════════════════════════════════════════

function getContactMessages() {
    var raw = localStorage.getItem('lovelink_contact_messages');
    if (!raw) return [];
    try { return JSON.parse(raw); } catch(e) { return []; }
}

function saveContactMessages(messages) {
    localStorage.setItem('lovelink_contact_messages', JSON.stringify(messages));
}

function markContactMessageRead(messageId) {
    const messages = getContactMessages();
    const idx = messages.findIndex(m => m.id === messageId);
    if (idx !== -1 && !messages[idx].read) {
        messages[idx].read = true;
        messages[idx].readAt = new Date().toISOString();
        saveContactMessages(messages);
        return true;
    }
    return false;
}

function markAllContactMessagesRead() {
    const messages = getContactMessages();
    let changed = false;
    messages.forEach(msg => {
        if (!msg.read) {
            msg.read = true;
            msg.readAt = new Date().toISOString();
            changed = true;
        }
    });
    if (changed) saveContactMessages(messages);
    return changed;
}

function deleteContactMessage(messageId) {
    const messages = getContactMessages();
    const filtered = messages.filter(m => m.id !== messageId);
    saveContactMessages(filtered);
    return filtered;
}

function updateSidebarContactBadge() {
    const unreadCount = getContactMessages().filter(m => !m.read).length;
    let badge = document.querySelector('.contact-badge');
    
    if (unreadCount > 0) {
        const contactNav = document.querySelector('.nav-item[data-page="contacts"]');
        if (contactNav) {
            // Remove existing badge if any
            const existingBadge = contactNav.querySelector('.contact-badge');
            if (existingBadge) existingBadge.remove();
            
            // Create new badge
            badge = document.createElement('span');
            badge.className = 'contact-badge';
            badge.style.cssText = `
                background: #ff4d6d;
                color: white;
                border-radius: 20px;
                padding: 2px 8px;
                font-size: 0.7rem;
                font-weight: 600;
                margin-left: auto;
            `;
            badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
            contactNav.querySelector('span').appendChild(badge);
        }
    } else {
        const contactNav = document.querySelector('.nav-item[data-page="contacts"]');
        if (contactNav) {
            const existingBadge = contactNav.querySelector('.contact-badge');
            if (existingBadge) existingBadge.remove();
        }
    }
}

function renderContactMessagesList(messages) {
    var container = document.getElementById('contactMessagesList');
    if (!container) return;
    
    if (messages.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="text-align: center; padding: 60px; background: white; border-radius: 20px;">
                <i class="fas fa-inbox" style="font-size: 3rem; color: #ccc; margin-bottom: 16px;"></i>
                <p style="color: #aaa;">No contact messages yet</p>
                <p style="color: #ccc; font-size: 0.85rem;">Messages from the contact form will appear here</p>
            </div>
        `;
        return;
    }
    
    var html = '<div style="display: flex; flex-direction: column; gap: 16px;">';
    
    for (var i = 0; i < messages.length; i++) {
        var msg = messages[i];
        var msgId = msg.id;
        var msgName = escapeHtml(msg.name);
        var msgEmail = escapeHtml(msg.email);
        var msgSubject = escapeHtml(msg.subject);
        var msgMessage = escapeHtml(msg.message);
        var msgCreatedAt = formatFullDate(msg.createdAt);
        var msgReadAt = msg.readAt ? formatFullDate(msg.readAt) : '';
        var msgRepliedAt = msg.repliedAt ? formatFullDate(msg.repliedAt) : '';
        var msgReplyMessage = msg.replyMessage ? escapeHtml(msg.replyMessage) : '';
        var isRead = msg.read;
        var hasReply = msg.replyMessage ? true : false;
        
        html += `
            <div class="contact-message-card" data-message-id="${msgId}" data-read="${isRead}" style="
                background: ${isRead ? 'white' : '#fff8f9'};
                border-radius: 16px;
                border-left: 4px solid ${isRead ? '#ddd' : '#ff4d6d'};
                box-shadow: 0 2px 8px rgba(0,0,0,0.05);
                transition: all 0.2s;
            ">
                <div style="padding: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px; margin-bottom: 12px;">
                        <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <div style="width: 40px; height: 40px; border-radius: 50%; background: ${isRead ? '#f0f0f0' : '#ff4d6d20'}; display: flex; align-items: center; justify-content: center;">
                                    <i class="fas fa-user" style="color: ${isRead ? '#999' : '#ff4d6d'};"></i>
                                </div>
                                <div>
                                    <strong style="color: #1a1a2e; font-size: 1rem;">${msgName}</strong>
                                    <div style="font-size: 0.75rem; color: #aaa;">${msgEmail}</div>
                                </div>
                            </div>
                            <span class="status-badge ${isRead ? 'status-inactive' : 'status-active'}" style="font-size: 0.7rem;">
                                ${isRead ? '<i class="fas fa-check"></i> Read' : '<i class="fas fa-envelope"></i> Unread'}
                            </span>
                            <span class="status-badge" style="background: #e3f2fd; color: #1976d2; font-size: 0.7rem;">
                                <i class="fas fa-tag"></i> ${msgSubject}
                            </span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <span style="font-size: 0.7rem; color: #aaa;">
                                <i class="far fa-calendar-alt"></i> ${msgCreatedAt}
                            </span>
                            <button class="delete-contact-msg" data-id="${msgId}" onclick="event.stopPropagation(); deleteContactMessageHandler('${msgId}')" style="
                                background: none;
                                border: none;
                                color: #ccc;
                                cursor: pointer;
                                padding: 6px;
                                border-radius: 50%;
                                transition: all 0.2s;
                            " onmouseover="this.style.color='#c62828';this.style.background='#ffebee'" onmouseout="this.style.color='#ccc';this.style.background='none'">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 12px;">
                        <div style="font-weight: 600; color: #1a1a2e; margin-bottom: 6px;">Message:</div>
                        <div style="color: #6b6b80; line-height: 1.5; background: #f8f9fa; padding: 12px; border-radius: 12px; white-space: pre-wrap;">
                            ${msgMessage}
                        </div>
                    </div>`;
        
        if (hasReply) {
            html += `
                        <div style="margin-bottom: 12px; background: #e8f5e9; border-radius: 12px; padding: 12px;">
                            <div style="font-weight: 600; color: #2e7d32; margin-bottom: 6px;">
                                <i class="fas fa-reply"></i> Your Reply:
                            </div>
                            <div style="color: #555; line-height: 1.5;">
                                ${msgReplyMessage}
                            </div>
                            <div style="font-size: 0.7rem; color: #888; margin-top: 6px;">
                                Sent on ${msgRepliedAt}
                            </div>
                        </div>`;
        }
        
        html += `
                        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 12px;">`;
        
        if (!isRead) {
            html += `
                            <button class="mark-read-btn" data-id="${msgId}" onclick="event.stopPropagation(); markSingleMessageRead('${msgId}')" style="
                                background: #e8f5e9;
                                border: none;
                                color: #2e7d32;
                                padding: 6px 14px;
                                border-radius: 20px;
                                font-size: 0.75rem;
                                cursor: pointer;
                                font-weight: 500;
                            ">
                                <i class="fas fa-check"></i> Mark as Read
                            </button>`;
        } else {
            html += `
                            <span style="font-size: 0.7rem; color: #aaa;">
                                <i class="fas fa-eye"></i> Read on ${msgReadAt}
                            </span>`;
        }
        
        html += `
                            <button class="reply-btn" data-email="${msgEmail}" data-name="${msgName}" onclick="event.stopPropagation(); openReplyModal('${msgEmail}', '${msgName}', '${msgId}')" style="
                                background: #e3f2fd;
                                border: none;
                                color: #1976d2;
                                padding: 6px 14px;
                                border-radius: 20px;
                                font-size: 0.75rem;
                                cursor: pointer;
                                font-weight: 500;
                            ">
                                <i class="fas fa-reply"></i> Reply
                            </button>
                        </div>
                    </div>
                </div>
            </div>`;
    }
    
    html += '</div>';
    container.innerHTML = html;
}

// Alias used inside contact message rendering (matches esc() already defined below)
function escapeHtml(str) { return esc(str); }

function filterContactMessages() {
    var searchEl  = document.getElementById('contactSearchInput');
    var statusEl  = document.getElementById('contactStatusFilter');
    var subjectEl = document.getElementById('contactSubjectFilter');
    var q       = searchEl  ? searchEl.value.toLowerCase()  : '';
    var status  = statusEl  ? statusEl.value                : 'all';
    var subject = subjectEl ? subjectEl.value               : 'all';

    var messages = getContactMessages();
    messages.sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });

    var filtered = messages.filter(function(m) {
        var matchQ = !q ||
            (m.name    || '').toLowerCase().indexOf(q) !== -1 ||
            (m.email   || '').toLowerCase().indexOf(q) !== -1 ||
            (m.subject || '').toLowerCase().indexOf(q) !== -1 ||
            (m.message || '').toLowerCase().indexOf(q) !== -1;
        var matchStatus  = status  === 'all' || (status  === 'read' ? m.read : !m.read);
        var matchSubject = subject === 'all' || m.subject === subject;
        return matchQ && matchStatus && matchSubject;
    });
    renderContactMessagesList(filtered);
}

function renderContactMessages() {
    var messages = getContactMessages();
    
    // Sort by date (newest first)
    messages.sort(function(a, b) {
        return new Date(b.createdAt) - new Date(a.createdAt);
    });
    
    var unreadCount = messages.filter(function(m) { return !m.read; }).length;
    
    var content = document.getElementById('pageContent');
    if (!content) return;
    
    content.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 12px;">
            <div>
                <h2 style="color: #1a1a2e; margin-bottom: 4px;"><i class="fas fa-envelope"></i> Contact Messages</h2>
                <p style="color: #6b6b80;">Messages from the contact form on the landing page</p>
            </div>
            <div style="display: flex; gap: 12px;">
                ${unreadCount > 0 ? `
                    <button id="markAllReadBtn" class="save-settings-btn" style="background: #4361ee; padding: 10px 20px;">
                        <i class="fas fa-check-double"></i> Mark All Read (${unreadCount})
                    </button>
                ` : ''}
                <button id="refreshContactsBtn" class="save-settings-btn" style="background: #6b6b80; padding: 10px 20px;">
                    <i class="fas fa-sync-alt"></i> Refresh
                </button>
            </div>
        </div>
        
        <div class="search-bar">
            <input type="text" id="contactSearchInput" class="search-input" placeholder="Search by name, email, subject or message...">
            <select id="contactStatusFilter" class="filter-select">
                <option value="all">All Messages</option>
                <option value="unread">Unread</option>
                <option value="read">Read</option>
            </select>
            <select id="contactSubjectFilter" class="filter-select">
                <option value="all">All Subjects</option>
                <option value="Account Issue">Account Issue</option>
                <option value="Billing Question">Billing Question</option>
                <option value="Report a User">Report a User</option>
                <option value="Feature Request">Feature Request</option>
                <option value="Other">Other</option>
            </select>
        </div>
        
        <div id="contactMessagesList" class="messages-list-container"></div>
    `;
    
    // Wait for DOM to update before rendering messages
    setTimeout(function() {
        renderContactMessagesList(messages);
    }, 50);
    
    // Add event listeners
    var searchInput = document.getElementById('contactSearchInput');
    var statusFilter = document.getElementById('contactStatusFilter');
    var subjectFilter = document.getElementById('contactSubjectFilter');
    
    if (searchInput) {
        searchInput.addEventListener('input', function() { filterContactMessages(); });
    }
    if (statusFilter) {
        statusFilter.addEventListener('change', function() { filterContactMessages(); });
    }
    if (subjectFilter) {
        subjectFilter.addEventListener('change', function() { filterContactMessages(); });
    }
    
    var markAllBtn = document.getElementById('markAllReadBtn');
    if (markAllBtn) {
        markAllBtn.addEventListener('click', function() {
            markAllContactMessagesRead();
            renderContactMessages();
            showToast('All messages marked as read', 'success');
            updateSidebarContactBadge();
        });
    }
    
    var refreshBtn = document.getElementById('refreshContactsBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() { renderContactMessages(); });
    }
}

function markSingleMessageRead(messageId) {
    markContactMessageRead(messageId);
    renderContactMessages();
    showToast('Message marked as read', 'success');
    updateSidebarContactBadge();
}

function deleteContactMessageHandler(messageId) {
    if (confirm('Are you sure you want to delete this message? This action cannot be undone.')) {
        deleteContactMessage(messageId);
        renderContactMessages();
        showToast('Message deleted', 'error');
        updateSidebarContactBadge();
    }
}

function openReplyModal(email, name, messageId) {
    // First mark as read if not already
    markContactMessageRead(messageId);
    
    const modal = document.createElement('div');
    modal.id = 'replyContactModal';
    modal.className = 'modal';
    modal.style.cssText = 'display: flex; align-items: center; justify-content: center; z-index: 10000;';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px; border-radius: 24px; overflow: hidden;">
            <div class="modal-header" style="background: linear-gradient(135deg, #ff4d6d, #ff758f); color: white;">
                <h3 style="color: white;"><i class="fas fa-reply"></i> Reply to ${escapeHtml(name)}</h3>
                <button class="close-modal" onclick="closeReplyModal()" style="color: white;">&times;</button>
            </div>
            <div style="padding: 24px;">
                <div style="margin-bottom: 16px;">
                    <label style="display: block; font-weight: 600; margin-bottom: 6px; color: #1a1a2e;">To:</label>
                    <input type="email" id="replyEmail" value="${escapeHtml(email)}" readonly style="width: 100%; padding: 10px; border: 2px solid #eef2f6; border-radius: 12px; background: #f8f9fa; font-family: inherit;">
                </div>
                <div style="margin-bottom: 16px;">
                    <label style="display: block; font-weight: 600; margin-bottom: 6px; color: #1a1a2e;">Subject:</label>
                    <input type="text" id="replySubject" value="Re: Your message to LoveLink Support" style="width: 100%; padding: 10px; border: 2px solid #eef2f6; border-radius: 12px; font-family: inherit;">
                </div>
                <div style="margin-bottom: 20px;">
                    <label style="display: block; font-weight: 600; margin-bottom: 6px; color: #1a1a2e;">Message:</label>
                    <textarea id="replyMessage" rows="5" placeholder="Type your reply here..." style="width: 100%; padding: 12px; border: 2px solid #eef2f6; border-radius: 12px; font-family: inherit; resize: vertical;"></textarea>
                </div>
                <div style="display: flex; gap: 12px;">
                    <button onclick="closeReplyModal()" style="flex: 1; padding: 12px; border: 2px solid #ddd; background: white; border-radius: 40px; font-weight: 600; cursor: pointer;">Cancel</button>
                    <button onclick="sendReply('${messageId}')" style="flex: 1; padding: 12px; background: linear-gradient(135deg, #ff4d6d, #ff758f); color: white; border: none; border-radius: 40px; font-weight: 600; cursor: pointer;">
                        <i class="fas fa-paper-plane"></i> Send Reply
                    </button>
                </div>
                <div id="replyStatus" style="margin-top: 16px; text-align: center; font-size: 0.85rem;"></div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function closeReplyModal() {
    const modal = document.getElementById('replyContactModal');
    if (modal) modal.remove();
}

function sendReply(messageId) {
    const email = document.getElementById('replyEmail')?.value;
    const subject = document.getElementById('replySubject')?.value;
    const message = document.getElementById('replyMessage')?.value;
    const statusDiv = document.getElementById('replyStatus');
    
    if (!message || !message.trim()) {
        if (statusDiv) {
            statusDiv.innerHTML = '<span style="color: #c62828;"><i class="fas fa-exclamation-circle"></i> Please enter a message</span>';
        }
        return;
    }
    
    // Simulate sending email (in a real app, this would call an API)
    if (statusDiv) {
        statusDiv.innerHTML = '<span style="color: #2e7d32;"><i class="fas fa-spinner fa-spin"></i> Sending reply...</span>';
    }
    
    setTimeout(() => {
        // Log the reply to console for demo purposes
        console.log('Reply sent:', { to: email, subject, message });
        
        if (statusDiv) {
            statusDiv.innerHTML = '<span style="color: #2e7d32;"><i class="fas fa-check-circle"></i> Reply sent successfully!</span>';
        }
        
        // Mark that a reply was sent for this message
        const messages = getContactMessages();
        const idx = messages.findIndex(m => m.id === messageId);
        if (idx !== -1) {
            messages[idx].replied = true;
            messages[idx].repliedAt = new Date().toISOString();
            messages[idx].replyMessage = message;
            saveContactMessages(messages);
        }
        
        setTimeout(() => {
            closeReplyModal();
            renderContactMessages();
            showToast('Reply sent to ' + email, 'success');
        }, 1500);
    }, 800);
}

function formatFullDate(dateString) {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        return date.toLocaleString('en', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch(e) {
        return dateString;
    }
}

function toggleRow(id, label, checked) {
    return '<div class="settings-group"><label>' + label + '</label>' +
        '<label class="toggle-switch"><input type="checkbox" id="' + id + '" ' + (checked ? 'checked' : '') + '><span class="toggle-slider"></span></label>' +
    '</div>';
}

function saveFreeLimits() {
    var s = JSON.parse(localStorage.getItem('lovelink_admin_settings') || '{}');
    s.freeMinutes = parseInt(document.getElementById('freeMinutes').value) || 5;
    s.freeLikes   = parseInt(document.getElementById('freeLikes').value)   || 5;
    localStorage.setItem('lovelink_admin_settings', JSON.stringify(s));
    showToast('Free limits saved', 'success');
}

function savePremiumPrices() {
    var s = JSON.parse(localStorage.getItem('lovelink_admin_settings') || '{}');
    s.premiumPrice     = parseFloat(document.getElementById('premiumPrice').value)     || 19.99;
    s.premiumPlusPrice = parseFloat(document.getElementById('premiumPlusPrice').value) || 29.99;
    localStorage.setItem('lovelink_admin_settings', JSON.stringify(s));
    showToast('Prices updated', 'success');
}

function saveFeatureToggles() {
    var s = JSON.parse(localStorage.getItem('lovelink_admin_settings') || '{}');
    s.features = {
        admirationEnabled:   document.getElementById('admirationEnabled').checked,
        videoDatesEnabled:   document.getElementById('videoDatesEnabled').checked,
        profileBoostEnabled: document.getElementById('profileBoostEnabled').checked
    };
    localStorage.setItem('lovelink_admin_settings', JSON.stringify(s));
    showToast('Feature settings saved', 'success');
}

function clearAllUsers() {
    if (!confirm('This will DELETE ALL USERS permanently. Are you absolutely sure?')) return;
    localStorage.removeItem('lovelink_users');
    localStorage.removeItem('lovelink_messages');
    allUsers = [];
    showToast('All users cleared', 'error');
    renderDashboard();
}

function clearAllMessages() {
    if (!confirm('Delete ALL chat messages permanently?')) return;
    localStorage.removeItem('lovelink_messages');
    showToast('All messages cleared', 'error');
}

// ════════════════════════════════════════════════════════════════════════════
//  ADMIN MANAGEMENT
// ════════════════════════════════════════════════════════════════════════════
function renderAdminManagement() {
    var roleColors = { super_admin: '#ff4d6d', moderator: '#4361ee', support: '#4cc9f0' };
    var roleLabels = { super_admin: 'Super Admin', moderator: 'Moderator', support: 'Support' };

    var rows = adminList.map(function (a) {
        var color   = roleColors[a.role] || '#888';
        var label   = roleLabels[a.role] || a.role;
        var initial = (a.name || a.email || '?')[0].toUpperCase();
        var isSelf  = a.email === adminSession.email;
        var actions = isSelf
            ? '<span style="color:#aaa;font-size:0.8rem;">(You)</span>'
            : '<button class="action-btn btn-view" onclick="editAdminModal(\'' + a.id + '\')"><i class="fas fa-edit"></i> Edit</button>' +
              '<button class="action-btn btn-ban" onclick="toggleAdminStatus(\'' + a.id + '\')">' +
                (a.active !== false ? '<i class="fas fa-pause"></i> Deactivate' : '<i class="fas fa-play"></i> Activate') +
              '</button>' +
              '<button class="action-btn btn-delete" onclick="removeAdmin(\'' + a.id + '\')"><i class="fas fa-trash"></i></button>';
        return '<tr>' +
            '<td><div style="display:flex;align-items:center;gap:10px;">' +
                '<div style="width:42px;height:42px;border-radius:50%;background:' + color + ';display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:1rem;flex-shrink:0;">' + initial + '</div>' +
                '<div><strong>' + esc(a.name || a.email) + '</strong><div style="font-size:0.75rem;color:#aaa;">' + esc(a.email) + '</div></div>' +
            '</div></td>' +
            '<td><span style="background:' + color + '20;color:' + color + ';padding:4px 12px;border-radius:20px;font-size:0.8rem;font-weight:600;">' + label + '</span></td>' +
            '<td style="color:#888;font-size:0.8rem;">' + fmtDate(a.createdAt) + '</td>' +
            '<td><span class="status-badge ' + (a.active !== false ? 'status-active' : 'status-inactive') + '">' + (a.active !== false ? 'Active' : 'Inactive') + '</span></td>' +
            '<td class="action-buttons">' + actions + '</td>' +
        '</tr>';
    }).join('');

    var permRows =
        permRow('View Users',      true,  true,  true)  +
        permRow('Suspend Users',   true,  true,  false) +
        permRow('Ban Users',       true,  true,  false) +
        permRow('Delete Users',    true,  false, false) +
        permRow('View Chats',      true,  true,  true)  +
        permRow('Delete Messages', true,  true,  false) +
        permRow('Delete Chats',    true,  true,  false) +
        permRow('Manage Admins',   true,  false, false) +
        permRow('System Settings', true,  false, false);

    document.getElementById('pageContent').innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">' +
            '<div><h2 style="color:#1a1a2e;margin-bottom:4px;">Admin Team</h2><p style="color:#aaa;font-size:0.9rem;">' + adminList.length + ' administrator(s)</p></div>' +
            '<button class="save-settings-btn" onclick="openAddAdminModal()"><i class="fas fa-user-plus"></i> Add Admin</button>' +
        '</div>' +
        '<div class="table-container">' +
            '<table class="data-table"><thead><tr><th>Admin</th><th>Role</th><th>Added</th><th>Status</th><th>Actions</th></tr></thead>' +
            '<tbody>' + (rows || '<tr><td colspan="5" style="text-align:center;padding:30px;color:#aaa;">No admins found</td></tr>') + '</tbody>' +
            '</table>' +
        '</div>' +
        '<div class="settings-section" style="margin-top:24px;">' +
            '<h3><i class="fas fa-shield-alt"></i> Role Permissions</h3>' +
            '<div style="overflow-x:auto;">' +
                '<table class="data-table"><thead><tr><th>Permission</th><th style="text-align:center;">Super Admin</th><th style="text-align:center;">Moderator</th><th style="text-align:center;">Support</th></tr></thead>' +
                '<tbody>' + permRows + '</tbody></table>' +
            '</div>' +
        '</div>';
}

function permRow(label, sa, mod, sup) {
    var yes = '<span style="color:#2dc653;font-size:1.1rem;"><i class="fas fa-check-circle"></i></span>';
    var no  = '<span style="color:#e63946;font-size:1.1rem;"><i class="fas fa-times-circle"></i></span>';
    return '<tr>' +
        '<td style="font-weight:500;">' + label + '</td>' +
        '<td style="text-align:center;">' + (sa  ? yes : no) + '</td>' +
        '<td style="text-align:center;">' + (mod ? yes : no) + '</td>' +
        '<td style="text-align:center;">' + (sup ? yes : no) + '</td>' +
    '</tr>';
}

function openAddAdminModal() {
    var modal = document.getElementById('addAdminModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id        = 'addAdminModal';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }
    modal.innerHTML =
        '<div class="modal-content" style="max-width:500px;">' +
            '<div class="modal-header">' +
                '<h3><i class="fas fa-user-plus" style="color:#ff4d6d;"></i> Add New Admin</h3>' +
                '<button class="close-modal" onclick="document.getElementById(\'addAdminModal\').style.display=\'none\'">&times;</button>' +
            '</div>' +
            '<div style="padding:24px;">' +
                '<label style="font-weight:600;display:block;margin-bottom:6px;">Full Name</label>' +
                '<input type="text" id="newAdminName" placeholder="Admin name" style="width:100%;padding:12px;border:2px solid #eee;border-radius:12px;font-family:inherit;margin-bottom:14px;">' +
                '<label style="font-weight:600;display:block;margin-bottom:6px;">Email Address</label>' +
                '<input type="email" id="newAdminEmail" placeholder="admin@email.com" style="width:100%;padding:12px;border:2px solid #eee;border-radius:12px;font-family:inherit;margin-bottom:14px;">' +
                '<label style="font-weight:600;display:block;margin-bottom:6px;">Password</label>' +
                '<input type="password" id="newAdminPassword" placeholder="Min 6 characters" style="width:100%;padding:12px;border:2px solid #eee;border-radius:12px;font-family:inherit;margin-bottom:14px;">' +
                '<label style="font-weight:600;display:block;margin-bottom:6px;">Role</label>' +
                '<select id="newAdminRole" style="width:100%;padding:12px;border:2px solid #eee;border-radius:12px;font-family:inherit;margin-bottom:20px;">' +
                    '<option value="moderator">Moderator</option>' +
                    '<option value="support">Support</option>' +
                    '<option value="super_admin">Super Admin</option>' +
                '</select>' +
                '<div id="addAdminError" style="display:none;padding:10px;background:#fee2e2;color:#c62828;border-radius:10px;margin-bottom:14px;font-size:0.85rem;"></div>' +
                '<button class="save-settings-btn" onclick="saveNewAdmin()" style="width:100%;"><i class="fas fa-plus-circle"></i> Create Admin</button>' +
            '</div>' +
        '</div>';
    modal.style.display = 'flex';
}

function saveNewAdmin() {
    var name     = document.getElementById('newAdminName').value.trim();
    var email    = document.getElementById('newAdminEmail').value.trim();
    var password = document.getElementById('newAdminPassword').value;
    var role     = document.getElementById('newAdminRole').value;
    var errEl    = document.getElementById('addAdminError');

    errEl.style.display = 'none';
    if (!name || !email || !password) {
        errEl.textContent = 'All fields are required.';
        errEl.style.display = 'block';
        return;
    }
    if (password.length < 6) {
        errEl.textContent = 'Password must be at least 6 characters.';
        errEl.style.display = 'block';
        return;
    }
    if (adminList.find(function (a) { return a.email === email; })) {
        errEl.textContent = 'An admin with this email already exists.';
        errEl.style.display = 'block';
        return;
    }

    adminList.push({
        id:        'admin_' + Date.now(),
        name:      name,
        email:     email,
        password:  password,
        role:      role,
        createdAt: new Date().toISOString(),
        active:    true
    });
    saveAdmins();
    document.getElementById('addAdminModal').style.display = 'none';
    showToast('Admin "' + name + '" created', 'success');
    renderAdminManagement();
}

function editAdminModal(adminId) {
    var admin = adminList.find(function (a) { return a.id === adminId; });
    if (!admin) return;
    var modal = document.getElementById('editAdminModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id        = 'editAdminModal';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }
    modal.innerHTML =
        '<div class="modal-content" style="max-width:460px;">' +
            '<div class="modal-header">' +
                '<h3><i class="fas fa-edit" style="color:#4361ee;"></i> Edit Admin</h3>' +
                '<button class="close-modal" onclick="document.getElementById(\'editAdminModal\').style.display=\'none\'">&times;</button>' +
            '</div>' +
            '<div style="padding:24px;">' +
                '<label style="font-weight:600;display:block;margin-bottom:6px;">Full Name</label>' +
                '<input type="text" id="editAdminName" value="' + esc(admin.name || '') + '" style="width:100%;padding:12px;border:2px solid #eee;border-radius:12px;font-family:inherit;margin-bottom:14px;">' +
                '<label style="font-weight:600;display:block;margin-bottom:6px;">Role</label>' +
                '<select id="editAdminRole" style="width:100%;padding:12px;border:2px solid #eee;border-radius:12px;font-family:inherit;margin-bottom:14px;">' +
                    '<option value="moderator" '  + (admin.role === 'moderator'   ? 'selected' : '') + '>Moderator</option>' +
                    '<option value="support" '    + (admin.role === 'support'     ? 'selected' : '') + '>Support</option>' +
                    '<option value="super_admin" '+ (admin.role === 'super_admin' ? 'selected' : '') + '>Super Admin</option>' +
                '</select>' +
                '<label style="font-weight:600;display:block;margin-bottom:6px;">New Password <span style="color:#aaa;font-weight:400;">(leave blank to keep)</span></label>' +
                '<input type="password" id="editAdminPassword" placeholder="New password..." style="width:100%;padding:12px;border:2px solid #eee;border-radius:12px;font-family:inherit;margin-bottom:20px;">' +
                '<button class="save-settings-btn" onclick="updateAdmin(\'' + adminId + '\')" style="width:100%;"><i class="fas fa-save"></i> Save Changes</button>' +
            '</div>' +
        '</div>';
    modal.style.display = 'flex';
}

function updateAdmin(adminId) {
    var idx = adminList.findIndex(function (a) { return a.id === adminId; });
    if (idx === -1) return;
    var name = document.getElementById('editAdminName').value.trim();
    var role = document.getElementById('editAdminRole').value;
    var pw   = document.getElementById('editAdminPassword').value;
    if (name) adminList[idx].name = name;
    adminList[idx].role = role;
    if (pw && pw.length >= 6) adminList[idx].password = pw;
    saveAdmins();
    document.getElementById('editAdminModal').style.display = 'none';
    showToast('Admin updated', 'success');
    renderAdminManagement();
}

function toggleAdminStatus(adminId) {
    var idx = adminList.findIndex(function (a) { return a.id === adminId; });
    if (idx === -1) return;
    adminList[idx].active = (adminList[idx].active === false) ? true : false;
    saveAdmins();
    renderAdminManagement();
    showToast('Admin ' + (adminList[idx].active ? 'activated' : 'deactivated'), adminList[idx].active ? 'success' : 'warning');
}

function removeAdmin(adminId) {
    if (!confirm('Remove this admin? They will lose dashboard access.')) return;
    adminList = adminList.filter(function (a) { return a.id !== adminId; });
    saveAdmins();
    renderAdminManagement();
    showToast('Admin removed', 'error');
}

// ════════════════════════════════════════════════════════════════════════════
//  UTILITIES
// ════════════════════════════════════════════════════════════════════════════
function togglePwDisplay(userId, pw) {
    var el = document.getElementById('pwDisplay_' + userId);
    if (!el) return;
    var btn = el.nextElementSibling;
    if (el.textContent === '••••••••') {
        el.textContent = pw || '(no password)';
        if (btn) btn.innerHTML = '<i class="fas fa-eye-slash"></i> Hide';
    } else {
        el.textContent = '••••••••';
        if (btn) btn.innerHTML = '<i class="fas fa-eye"></i> Show';
    }
}

function resetUserPassword(userId) {
    if (!confirm('Reset this user\'s password to "123456"?')) return;
    var idx = allUsers.findIndex(function (u) { return u.id === userId; });
    if (idx === -1) return;
    allUsers[idx].password = '123456';
    saveUsers();
    // Refresh the password display in modal
    var el = document.getElementById('pwDisplay_' + userId);
    if (el) el.textContent = '••••••••';
    showToast('Password reset to 123456', 'success');
}
function esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function avatarUrl(name) {
    return 'https://ui-avatars.com/api/?background=ff4d6d&color=fff&name=' + encodeURIComponent(name || '?') + '&size=200';
}

function fmtDate(d) {
    if (!d) return 'N/A';
    try { return new Date(d).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch (e) { return String(d); }
}

function formatRole(role) {
    var map = { super_admin: 'Super Admin', moderator: 'Moderator', support: 'Support' };
    return map[role] || role;
}

function showToast(message, type) {
    type = type || 'success';
    var colors = { success: '#2dc653', warning: '#f4a261', error: '#e63946', info: '#4361ee' };
    var icons  = { success: 'fa-check-circle', warning: 'fa-exclamation-circle', error: 'fa-ban', info: 'fa-info-circle' };
    var toast  = document.createElement('div');
    toast.style.cssText =
        'position:fixed;bottom:24px;right:24px;background:' + (colors[type] || colors.success) + ';color:white;' +
        'padding:14px 22px;border-radius:40px;z-index:99999;display:flex;align-items:center;gap:10px;' +
        'box-shadow:0 8px 20px rgba(0,0,0,0.2);font-weight:600;font-size:0.9rem;' +
        'animation:llToastIn 0.3s ease;font-family:inherit;';
    toast.innerHTML = '<i class="fas ' + (icons[type] || icons.success) + '"></i> ' + message;
    document.body.appendChild(toast);
    setTimeout(function () {
        toast.style.opacity  = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
    }, 3000);
}

// Inject animations + suspended badge style once
(function () {
    var s = document.createElement('style');
    s.textContent =
        '@keyframes llToastIn { from { transform:translateX(120%);opacity:0; } to { transform:translateX(0);opacity:1; } }' +
        '.status-suspended { background:#fff3e0;color:#e65100; }';
    document.head.appendChild(s);
}());
