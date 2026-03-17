function showMessage() {
    alert("Sample chapter feature will be available soon!");
}

async function submitIssue() {
    const nameInput = document.getElementById('contact-name');
    const emailInput = document.getElementById('contact-email');
    const messageInput = document.getElementById('contact-message');
    const alertBox = document.getElementById('contact-alert');
    const submitBtn = document.getElementById('contact-submit-btn');

    if (!nameInput || !emailInput || !messageInput) {
        console.error("Contact form elements not found.");
        return;
    }

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const message = messageInput.value.trim();

    if (!name || !email || !message) {
        showAlert('Please fill out all fields.', 'error');
        return;
    }

    const originalText = submitBtn.innerText;
    submitBtn.innerText = 'Sending...';
    submitBtn.disabled = true;

    try {
        const response = await fetch('http://localhost:3000/api/contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, message })
        });

        const data = await response.json();

        if (response.ok) {
            showAlert('Your issue has been submitted successfully! We will contact you soon.', 'success');
            nameInput.value = '';
            emailInput.value = '';
            messageInput.value = '';
        } else {
            showAlert(data.error || 'Something went wrong', 'error');
        }
    } catch (err) {
        console.error(err);
        showAlert('Network error. Make sure the server is running.', 'error');
    } finally {
        submitBtn.innerText = originalText;
        submitBtn.disabled = false;
    }
}

function showAlert(msg, type) {
    const alertBox = document.getElementById('contact-alert');
    if (!alertBox) return;
    
    alertBox.innerText = msg;
    alertBox.classList.remove('hidden', 'bg-red-50', 'text-red-700', 'bg-green-50', 'text-green-700');
    
    if (type === 'error') {
        alertBox.classList.add('bg-red-50', 'text-red-700');
    } else {
        alertBox.classList.add('bg-green-50', 'text-green-700');
    }
    
    setTimeout(() => {
        alertBox.classList.add('hidden');
    }, 5000);
}

function buyBook(bookName) {
    alert("You selected: " + bookName + "\nRedirecting to checkout soon!");
}