$(document).ready(function(){
    handleKeywordsBehavior();
    $('form#titlegenerator').on('submit',function(e){
        e.preventDefault()
        submitForm();
    })
});
function submitForm() {
    if($('form#titlegenerator').hasClass('busy')){
        return;
    }
    $('form#titlegenerator').addClass('busy');
    $('button#suggest-topics .text').text('Loading ...');

    // Array to hold keywords
    var keywords = [];
    $('.keyword-badge').each(function() {
        keywords.push($(this).data('keyword'));
    });

    // Get values from country and language select elements
    var country = $('#country').val();
    var language = $('#language').val();
    var tone = $('#tone').val();
    // Construct the data object
    var data = {
        keywords,
        country,
        language ,
        tone
    };

    handleFormSubmit(data);
}
function handleFormSubmit(data) {
    $.ajax({
        url: '/api/titlegenerator/generate-titles',
        type: 'POST',
        data: JSON.stringify(data), // Stringify the JSON data
        contentType: 'application/json', // Set content type to JSON
        processData: false, // Prevent jQuery from processing the data
        success: function(response) {
            console.log('Form submitted successfully:', response);
            handleFormResponse(response);
        },
        error: function(xhr, status, error) {
            console.error('Form submission error:', error);
        },
        complete: function() {
            $('form#titlegenerator').removeClass('busy');
            $('button#suggest-topics .text').text('提案されるトピック');
        }
    });
}

function handleFormResponse(data) {
    // Assuming 'data' is an array of titles
    // Clear existing content in the list
    $('#result').empty();

    // Loop through each title in the data array
    $.each(data.titles, function(index, title) {
        // Create a list item for each title
        var listItem = $('<li>', {
            'class': 'list-group-item', // Add Bootstrap list item class
            text: title // Set the text of the list item
        });

        // Append the list item to the unordered list
        $('#result').append(listItem);
    });
    // Loop through each title in the data array
    $.each(data.seoSearch, function(index, item) {
        // Create a list item for each title
        var listItem = $('<li>', {
            'class': 'list-group-item', 
        });
        var hyperlink = $('<a>',{
            'href':item.link,
            text: item.title,
            target:'_blank'
        })

        listItem.append(hyperlink)
        $('#seoSearch').append(listItem);
    });
}

function handleKeywordsBehavior(){
    $('#keywords').on('keydown', function(e) {
        // When Enter key is pressed or comma is entered
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault(); // Prevent default behavior
            
            var input = $(this).val().trim(); // Get the input value and trim whitespace
            if (input) { // If there's some input
                input = input.replace(/,$/, ""); // Remove trailing comma if present
                // Create the tag (you need to style it with CSS)
                var html = '<span class="col btn keyword-badge shadow-0 position-relative m-0 border border-dark rounded-0" data-keyword="' + input + '">' + input + 
                           '<i type="button" class="remove-tag fa fa-times position-absolute" style="top:3px;right:5px;"></i></span>';
                $(this).before(html); // Insert the tag before the input field
                $(this).val(''); // Clear the input field
            }
        }
        updateInput();
    });

    // Functionality to remove a tag when the remove button is clicked
    $(document).on('click', '.remove-tag', function() {
        $(this).parent('.keyword-badge').remove();
        updateInput()
    });
}
function updateInput(){
    const keywords = $('.keyword-badge').length
    if(keywords>0){
        $('#keywords').attr('required',false)
        return
    }
    $('#keywords').attr('required',true)
}