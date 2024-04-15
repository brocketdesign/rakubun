$(document).ready(function() {

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

     // Function to fetch all affiliates data
     function fetchAffiliates() {
        $.ajax({
            url: '/api/affiliate/all-affiliate-data',
            method: 'GET',
            success: function(data) {
                populateTable(data);
            },
            error: function(error) {
                console.error('Error fetching affiliates:', error);
                alert('Failed to fetch affiliates data.');
            }
        });
    }

    // Function to populate the table with affiliate data
    function populateTable(affiliates) {
        const tableBody = $('#affiliateTableBody');
        tableBody.empty(); // Clear existing table rows

        affiliates.forEach(affiliate => {
            const row = `
                <tr>
                    <td>${affiliate.name}</td>
                    <td>${affiliate.email}</td>
                    <td><a href="${affiliate.websiteUrl}" target="_blank">${affiliate.websiteUrl}</a></td>
                    <td><button class="btn btn-info" onclick="checkStatus('${affiliate._id}')">Check Status</button></td>
                    <td>
                        <div class="form-check form-switch">
                            <input class="form-check-input" type="checkbox" ${affiliate.isActive ? 'checked' : ''} onchange="toggleActivation('${affiliate._id}', this.checked)">
                        </div>
                    </td>
                </tr>
            `;
            tableBody.append(row);
        });
    }

    window.checkStatus = function(affiliateId) {
        $.ajax({
        url: '/api/affiliate/check-status/' + affiliateId,
        success: function(response) {
            alert('Status: ' + response.status);
        },
        error: function() {
            alert('Failed to check status.');
        }
        });
    };
    
    window.toggleActivation = function(affiliateId, isActive) {
        $.ajax({
        url: '/api/affiliate/activate-affiliate',
        method: 'POST',
        data: JSON.stringify({ affiliateId, isActive }),
        contentType: 'application/json',
        success: function(response) {
            alert('Activation changed');
        },
        error: function() {
            alert('Failed to change activation.');
        }
        });
    };
      
    // Fetch affiliates on document ready
    fetchAffiliates();
});
