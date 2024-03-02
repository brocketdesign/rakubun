$(document).ready(function() {
    $('#autoBlogForm').on('submit', function(event) {
        event.preventDefault(); // Prevent the form from submitting via the browser
        var formData = $(this).serialize(); // Serialize the form data
        console.log(formData)
        // You can add validation or manipulation of formData here

        $.ajax({
            type: 'POST',
            url: '/api/autoblog/info',
            data: formData,
            success: function(response) {
                // Handle success
                alert('Form successfully submitted');
                console.log(response);
            },
            error: function() {
                // Handle error
                alert('An error occurred');
            }
        });
    });
    var blogId = $('#blogId').data('id'); // Assume #blogId is your input field for the blog ID
    if(blogId) {
        $.ajax({
            url: '/api/autoblog/info/' + blogId,
            type: 'GET',
            success: function(blogInfo) {
                Object.keys(blogInfo).forEach(function(key) {
                    // Check if an input field with an ID matching the key exists
                    var $input = $('#' + key);
                    if ($input.length) {
                        // Populate the input field with the value from the corresponding key in blogInfo
                        $input.val(blogInfo[key]);
                    }
                });
            },
            error: function(xhr, status, error) {
                // Handle errors
                console.error("Failed to fetch blog info:", error);
            }
        });
        $.ajax({
            url: '/api/autoblog/info/category/' + blogId,
            type: 'GET',
            success: function(categories) {
                console.log(categories)
                for(let category of categories){
                    $('#postCategory').append(`
                        <option value=${category.termId}>${category.name}</option>
                    `)
                }
            },
            error: function(xhr, status, error) {
                // Handle errors
                console.error("Failed to fetch blog info:", error);
            }
        });
    }
    deleteButton();
    duplicateButton();
});
function duplicateButton() {
    $('.duplicate-blog-btn').off('click').on('click', function() {
        var blogId = $(this).attr('data-id'); // Get the blogId from the button's data-id attribute

        $.ajax({
            url: '/api/autoblog/duplicate/' + blogId, // Adjust this URL as needed
            type: 'POST',
            success: function(response) {
                // Assuming the response contains the newBlogId
                var newBlogId = response.newBlogId;
                // Redirect to the new blog's info page
                window.location.href = '/dashboard/app/autoblog/info/' + newBlogId;
            },
            error: function(xhr, status, error) {
                // Handle errors (e.g., display an error message)
                alert("Failed to duplicate blog info: " + error);
            }
        });
    });
}

// Call the function when the document is ready
$(document).ready(function() {
    duplicateButton();
});

function deleteButton(){
    $('.delete-blog-btn').on('click', function() {
        var blogId = $(this).data('id'); // Assuming the button's id attribute contains the blogId

        if(confirm('Are you sure you want to delete this blog info?')) {
            $.ajax({
                url: '/api/autoblog/info/' + blogId,
                type: 'DELETE',
                success: function(response) {
                    alert(response.message);
                    // Optionally, remove the deleted blog info from the DOM or refresh the page
                    // $('#someElementRepresentingTheBlog').remove();
                    window.location ='/dashboard/app/autoblog/'
                },
                error: function(xhr, status, error) {
                    // Handle errors
                    alert("Failed to delete blog info: " + error);
                }
            });
        }
    });
}
function toggleBlogStatus(blogId, newState) {
    fetch(`/api/autoblog/info/ `, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ blogId: blogId, isActive: newState }),
    })
    .then(response => response.json())
    .then(data => {
        // Handle response
        console.log(data);
        window.location.reload(); // Reload the page to see the updated state
    })
    .catch((error) => {
        console.error('Error:', error);
    });
}
