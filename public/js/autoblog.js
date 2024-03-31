$(document).ready(function() {
    $('#botForm').on('submit', function(event) {
        event.preventDefault(); // Prevent the form from submitting via the browser
        var formData = $(this).serialize(); // Serialize the form data

        // You can add validation or manipulation of formData here

        $.ajax({
            type: 'POST',
            url: '/api/autoblog/bot-info',
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
    $('#autoBlogForm').on('submit', function(event) {
        event.preventDefault(); // Prevent the form from submitting via the browser
        var formData = $(this).serialize(); // Serialize the form data

        // You can add validation or manipulation of formData here

        $.ajax({
            type: 'POST',
            url: '/api/autoblog/blog-info',
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
            url: '/api/autoblog/blog-info/' + blogId,
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
        updateCategoryList(blogId)

    }
    var botId = $('#botId').data('id');
    if(botId){
        $.ajax({
            url: '/api/autoblog/bot-info/' + botId,
            type: 'GET',
            success: function(botInfo) {

                Object.keys(botInfo).forEach(function(key) {
                    // Check if an input field with an ID matching the key exists
                    var $input = $('#' + key);
                    if ($input.length) {
                        // Populate the input field with the value from the corresponding key in blogInfo
                        $input.val(botInfo[key]);
                    }
                });
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
    $('.duplicate-bot-btn').off('click').on('click', function() {
        var botId = $(this).attr('data-id'); // Get the blogId from the button's data-id attribute

        $.ajax({
            url: '/api/autoblog/duplicate-bot/' + botId, // Adjust this URL as needed
            type: 'POST',
            success: function(response) {
                // Assuming the response contains the newBlogId
                var newBotId = response.newBotId;
                // Redirect to the new blog's info page
                window.location.href = '/dashboard/app/autoblog/bot?botId=' + newBotId;
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
    $('.delete-bot-btn').on('click', function() {
        var botId = $(this).data('id'); // Assuming the button's id attribute contains the blogId

        if(confirm('Are you sure you want to delete this blog info?')) {
            $.ajax({
                url: '/api/autoblog/bot/' + botId,
                type: 'DELETE',
                success: function(response) {
                    //alert(response.message);
                    $(`.card[data-id="${botId}"]`).fadeOut()
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
    fetch(`/api/autoblog/bot/ `, {
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
function toggleBotStatus(botId, newState) {
    fetch(`/api/autoblog/bot-info/ `, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ botId: botId, isActive: newState }),
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
function updateCategoryList(blogId) {
    $.ajax({
        url: '/api/autoblog/info/category/' + blogId,
        type: 'GET',
        success: function(categories) {

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