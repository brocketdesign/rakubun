$(document).ready(function() {
    console.log(`script here`)
    $('#statusForm').on('submit', function(e) {
        e.preventDefault(); // Prevent the default form submission
        const wordpressUrl = $('#wordpressUrl').val();
        if (!wordpressUrl) {
            alert('Please enter a WordPress site URL.');
            return;
        }

        $.ajax({
            url: '/api/affiliate/check-plugin-status', // Adjust this if your endpoint URL is different
            method: 'GET',
            data: { wordpressUrl: wordpressUrl },
            success: function(response) {
                $('#result').removeClass('hidden alert-danger').addClass('alert-success').text(`Status: ${response.status}`);
            },
            error: function(xhr) {
                $('#result').removeClass('hidden alert-success').addClass('alert-danger').text(`Error: ${xhr.responseText || 'Failed to fetch plugin status'}`);
            }
        });
    });
});
