document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const loginButton = document.getElementById('login-button');
    const messageContainer = document.getElementById('message-container');

    if (localStorage.getItem('firstName')) {
        window.location.href = 'index.html';
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        if (!username || !password) {
            showMessage('Username and password cannot be empty.', 'error');
            return;
        }

        setLoading(true, 'Authenticating, please wait...');

        try {
            const response = await fetch(`https://dummyjson.com/users/filter?key=username&value=${username}`);

            if (!response.ok) {
                throw new Error('Network response was not ok. Could not reach server.');
            }

            const data = await response.json();

            if (data.users && data.users.length > 0) {
                const user = data.users[0];

                if (user.password === password) {
                    showMessage('Login successful! Redirecting...', 'success');
                    localStorage.setItem('firstName', user.firstName);

                    setTimeout(() => {
                        window.location.href = 'index.html';
                    }, 1500);
                } else {
                    throw new Error('Incorrect password. Please try again.');
                }
            } else {
                throw new Error('Username not found.');
            }

        } catch (error) {
            showMessage(error.message || 'An error occurred. Please try again.', 'error');
            setLoading(false); 
        }
    });

    function showMessage(message, type) {
        messageContainer.textContent = message;
        messageContainer.style.color = type === 'success' ? 'var(--success-color)' : 'var(--error-color)';
    }

    function setLoading(isLoading, message = '') {
        loginButton.disabled = isLoading;
        if (isLoading) {
            showMessage(message, 'info');
        }
    }
});
