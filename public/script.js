document.addEventListener('DOMContentLoaded', async () => {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = 'Searching for passwords...'; // Show loading message

    try {
        const response = await fetch('/find-passwords'); // Endpoint to call the Node.js function
        const data = await response.json();

        // Clear the loading message
        resultsDiv.innerHTML = '';

        // Display results
        data.forEach(result => {
            const p = document.createElement('p');
            p.innerHTML = result; // Use innerHTML to correctly display line breaks
            resultsDiv.appendChild(p);
        });
    } catch (error) {
        resultsDiv.innerHTML = 'Error fetching passwords.';
        console.error(error);
    }
});
