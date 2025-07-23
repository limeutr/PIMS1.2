// User credentials and roles
const users = {
    'admin': { password: 'admin', role: 'supervisor', name: 'Admin' },
    'supervisor': { password: 'supervisor', role: 'supervisor', name: 'Supervisor' },
    'staff1': { password: 'staff123', role: 'staff', name: 'Staff Member #1' },
};

// Session management
function setUserSession(username, userData) {
    const sessionData = {
        username: username,
        role: userData.role,
        name: userData.name,
        loginTime: new Date().toISOString()
    };
    
    // Store in sessionStorage (will be lost when browser is closed)
    sessionStorage.setItem('userSession', JSON.stringify(sessionData));
    
    // Also store in localStorage for persistence
    localStorage.setItem('userSession', JSON.stringify(sessionData));
}

function getUserSession() {
    const sessionData = sessionStorage.getItem('userSession') || localStorage.getItem('userSession');
    return sessionData ? JSON.parse(sessionData) : null;
}

function clearUserSession() {
    sessionStorage.removeItem('userSession');
    localStorage.removeItem('userSession');
}

// Check if user is already logged in
function checkExistingSession() {
    const session = getUserSession();
    if (session) {
        // User is already logged in, redirect to dashboard
        redirectToDashboard();
    }
}

// Login form handler
document.addEventListener('DOMContentLoaded', function() {
    // Check for existing session
    checkExistingSession();
    
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('error-message');
    
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        
        // Hide previous error messages
        errorMessage.style.display = 'none';
        
        // Add loading state
        document.body.classList.add('loading');
        
        // Simulate authentication delay
        setTimeout(() => {
            if (authenticateUser(username, password)) {
                // Successful login
                const userData = users[username];
                setUserSession(username, userData);
                
                // Show success message briefly
                showSuccessMessage('Login successful! Redirecting...');
                
                // Redirect after a short delay
                setTimeout(() => {
                    redirectToDashboard();
                }, 1500);
            } else {
                // Failed login
                document.body.classList.remove('loading');
                errorMessage.style.display = 'block';
                
                // Shake animation for error
                loginForm.style.animation = 'shake 0.5s ease-in-out';
                setTimeout(() => {
                    loginForm.style.animation = '';
                }, 500);
            }
        }, 1000);
    });
});

// Authenticate user
function authenticateUser(username, password) {
    const user = users[username];
    return user && user.password === password;
}

// Show success message
function showSuccessMessage(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    errorDiv.style.backgroundColor = '#d4edda';
    errorDiv.style.color = '#155724';
    errorDiv.style.borderColor = '#c3e6cb';
}

// Redirect to appropriate dashboard based on user role
function redirectToDashboard() {
    const session = getUserSession();
    if (session) {
        if (session.role === 'supervisor') {
            window.location.href = 'supervisor-dashboard.html';
        } else {
            window.location.href = 'index.html';
        }
    } else {
        window.location.href = 'index.html';
    }
}

// Add CSS for shake animation
const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
        20%, 40%, 60%, 80% { transform: translateX(5px); }
    }
`;
document.head.appendChild(style);
