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

    function fetchAndDisplayAnalytics(affiliates) {
        const today = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
    
        affiliates.forEach(affiliate => {
            ['opened', 'interacted'].forEach(action => {
                $.get(`/api/affiliate/fetch-popup-data`, { affiliateId: affiliate._id, action: action, today: today })
                    .done((data) => {
                        // Update the table cells for daily and monthly data
                        $(`#row-${affiliate._id} .analytics-${action}`).html(`
                            本日: ${data.daily} | 今月: ${data.monthly}
                        `);
                    })
                    .fail((error) => {
                        console.error(`Failed to fetch analytics for ${action}:`, error);
                        $(`#row-${affiliate._id} .analytics-${action}`).html('Error fetching data');
                    });
            });
        });
    }

    function populateTable(affiliates) {
        const tableBody = $('#affiliateTableBody');
        tableBody.empty(); // Clear existing table rows
    
        affiliates.forEach(affiliate => {
            const row = `
                <tr id="row-${affiliate._id}">
                    <td>${affiliate.name}</td>
                    <td><a href="${affiliate.wordpressUrl}" target="_blank">${affiliate.wordpressUrl}</a></td>
                    <td class="analytics-opened"></td>
                    <td class="analytics-interacted"></td>
                    <td>
                        <div class="form-check form-switch">
                            <input class="form-check-input" type="checkbox" ${affiliate.isActive ? 'checked' : ''} onchange="toggleActivation('${affiliate._id}', this.checked)">
                        </div>
                    </td>
                    <td><button class="btn btn-info" onclick="checkStatus('${affiliate._id}')"><i class="fas fa-bolt"></i></button></td>
                    <td>
                        <button class="btn btn-danger" onclick="deleteAffiliate('${affiliate._id}')"><i class="far fa-trash-alt"></i></button>
                    </td>
                </tr>
            `;
            tableBody.append(row);
        });

        fetchAndDisplayAnalytics(affiliates);
    }

    
    window.checkStatus = function(affiliateId) {
        $.ajax({
            url: '/api/affiliate/check-plugin-status?affiliateId=' + affiliateId,
            success: function(response) {
                Swal.fire({
                    title: 'Status:',
                    text: response.status,
                    icon: 'success',
                    confirmButtonText: 'Cool'
                });
            },
            error: function() {
                Swal.fire({
                    title: 'Oops...',
                    text: 'Failed to check status.',
                    icon: 'error',
                    confirmButtonText: 'Got it'
                });
            }
        });
    };
    window.toggleActivation = function(affiliateId, isActive) {
        console.log({isActive})
        $.ajax({
            url: '/api/affiliate/affiliate-data',
            method: 'POST',
            data: JSON.stringify({ affiliateId, updates: { isActive } }),
            contentType: 'application/json',
            success: function(response) {
                Swal.fire({
                    title: 'Success!',
                    text: 'Activation changed',
                    icon: 'success',
                    confirmButtonText: 'Awesome!'
                });
            },
            error: function() {
                Swal.fire({
                    title: 'Oops...',
                    text: 'Failed to change activation.',
                    icon: 'error',
                    confirmButtonText: 'I\'ll try again'
                });
            }
        });
    };
        
      
    // Fetch affiliates on document ready
    fetchAffiliates();
});

function deleteAffiliate(affiliateId) {
    Swal.fire({
        title: 'Are you sure?',
        text: "You won't be able to revert this!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
        if (result.isConfirmed) {
            $.ajax({
                url: `/api/affiliate/delete-affiliate/${affiliateId}`,
                method: 'DELETE',
                success: function(response) {
                    $(`#row-${affiliateId}`).remove();
                    Swal.fire(
                        'Deleted!',
                        'Affiliate has been deleted.',
                        'success'
                    );
                },
                error: function() {
                    Swal.fire(
                        'Failed!',
                        'Failed to delete affiliate.',
                        'error'
                    );
                }
            });
        }
    });
}
