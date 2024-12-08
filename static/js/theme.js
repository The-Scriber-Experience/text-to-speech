document.addEventListener('DOMContentLoaded', () => {
    const themeSwitch = document.getElementById('themeSwitch');
    
    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'space') {
        themeSwitch.checked = true;
        document.documentElement.setAttribute('data-theme', 'space');
    }

    // Theme switch handler
    themeSwitch.addEventListener('change', (e) => {
        if (e.target.checked) {
            document.documentElement.setAttribute('data-theme', 'space');
            localStorage.setItem('theme', 'space');
        } else {
            document.documentElement.setAttribute('data-theme', 'medieval');
            localStorage.setItem('theme', 'medieval');
        }
    });
});
