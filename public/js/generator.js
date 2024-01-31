$(document).ready(function(){
    handleKeywordsBehavior();

    $('form#generator').on('submit',function(e){
        e.preventDefault()
        submitForm($(this));
    });
    const id = getQueryParam('id');
    if(id){
        $.get('/api/generator/data?id='+id,function(data){
            if (data) {
                console.log(data)
                if(data.request && data.request.TITLE){
                    $('#title').val(data.request.TITLE);
                }
                $('#sections').val(data.completion).attr('data-sections',data.completion);
            }
        })
    }
    var titleFromURL = getQueryParam('title');
    if (titleFromURL) {
        $('#title').val(decodeURIComponent(titleFromURL));
    }
});
// Function to grab query params from the URL
function getQueryParam(param) {
    var queryParams = new URLSearchParams(window.location.search);
        return queryParams.get(param);
}

function submitForm(formSelector) {
    if(formSelector.hasClass('busy')){
        return;
    }
    const type = formSelector.data('type')
    formSelector.addClass('busy');
    $(`button#generation .text`).text('Loading ...');

    var keywords = [];
    $('.keyword-badge').each(function() {
        keywords.push($(this).data('keyword'));
    });

    let sections = $('#sections').val() || '';
    sections = sections.trim().split(',').filter(title => title.length);
    if (sections.length === 0) {
        sections = [''];
    }

    for (let [index, section] of sections.entries()) {
        var data = {
            KEYWORDS:keywords,
            SECTION : section,
            SECTIONS_COUNT : $('#sectionsCount').val(),
            COUNT:$('#count').val(),
            TITLE : $('#title').val(),
            WRITING_STYLE : $('#writingStyle').val(),
            LANGUAGE : $('#language').val(),
            WRITING_TONE : $('#writingTone').val(),
            INDEX:index
        };
        console.log(data)
        
        handleFormSubmit(type,data);
    }
}

function handleFormSubmit(type, data) {
    generateStream(type, data, handleStreamSuccess(type, data), handleStreamError(), handleStreamFinally());
    if($('#seoSearch').length>0){
        seoSearch(data)
    }
}

function handleStreamSuccess(type, data) {
    return function(response) {
        handleStream(response, appendMessageToContainer(type, data, response), handleStreamEnd(type, data,response));
    };
}

function appendMessageToContainer(type, data, response) {
    return function(message) {
        const containerID = `response-${type}-${response.insertedId}-${data.INDEX}`;
        if ($(`#${containerID}`).length == 0) {
            const initialCardHtml = `
                <div class="card mb-3">
                    <div class="card-body">
                        <div id=${containerID}></div>
                        <div class="row">
                            <div data-id=${containerID} class="action-button"></div>
                        </div>                   
                    </div>
                </div>`;
            $('#result').prepend(initialCardHtml);
        }
        $(`#${containerID}`).append(message);
    };
}

function handleStreamEnd(type, data,response) {
    return function(stream_data) {
        const completionId = stream_data.id
        const containerID = `response-${type}-${response.insertedId}-${data.INDEX}`;
        convertResponse(`#${containerID}`,stream_data);
        udpateSendButton(containerID,completionId)
    };
}

function handleStreamError() {
    return function() {
        updateUIAfterStream();
    };
}

function handleStreamFinally() {
    return function() {
        updateUIAfterStream();
    };
}

function updateUIAfterStream() {
    $(`form#generator`).removeClass('busy');
    $(`#generation .text`).text('提案されるトピック');
}

function udpateSendButton(containerID,completionId){
    const type = parseInt($('form#generator').data('type'))
    const next_type = type + 1

    if($(`.send-${completionId}`).length == 0){
        $(`#result .action-button[data-id="${containerID}"]`)
        .append(`<a class="col-12 col-sm-6 btn btn-primary send-${completionId}" href="/dashboard/app/generator/${next_type}?id=${completionId}" target="_blank">NEXT</a>`)
    }
}

function convertResponse(sourceSelector,stream_data) {
    const type = parseInt($('form#generator').data('type'))
    if(type == 1){
        var list = $('<ul>', {
            'class': 'list-group', 
            'id':`list-${stream_data.id}`
        });
        $(sourceSelector).html(list);

        $.each(stream_data.completion, function(index, title) {
            var listItem = $('<li>', {
                'class': 'list-group-item', 
            });
            
            var hyperlink = $('<a>',{
                'href':`/dashboard/app/generator/2?id=${stream_data.id}&title=${title}`,
                text: title,
                target:'_blank'
            })
    
            $(document).find(`#list-${stream_data.id}`).append(listItem.append(hyperlink))

        });
        return
    }
    // Use showdown library to convert markdown to HTML
    const converter = new showdown.Converter();
    
    function convertMarkdownToHTML(markdownContent) {
        return converter.makeHtml(markdownContent);
    }

    
    let markdownContent = $(sourceSelector).text();
    let htmlContent = convertMarkdownToHTML(markdownContent);
    $(sourceSelector).html(htmlContent);
}

function generateStream(type, data, callback, errorcallback, finallyCallback) {
    // Simulate request
    $.ajax({
        url: '/api/generator/generate/' + type, // Replace with your endpoint
        method: 'POST',
        data: data,
        success: function(response) {
            callback(response);
        },
        error: function(jqXHR, textStatus, errorThrown) {
            console.error('Error: ', errorThrown);
            errorcallback(jqXHR, textStatus, errorThrown); // Pass error details to the callback
        }
    }).always(function() {
        finallyCallback(); // This will execute after success or error
    });
}

function seoSearch(data,callback,errorcallback,finallyCallback){
    $.ajax({
        url: '/api/generator/seoSearch/', // Replace with your endpoint
        method: 'POST',
        data,
        success: function(response) {
            if (callback) {callback(response)}
            createListSearch(response);
        },
        error: function(jqXHR, textStatus, errorThrown) {
            console.error('Error: ', errorThrown);
            if(errorcallback){errorcallback(jqXHR, textStatus, errorThrown);}
             // Pass error details to the callback
        }
    }).always(function() {
        if(finallyCallback){finallyCallback();}
    });
}

function handleStream(response,callback,endCallback) {

    // Establish an EventSource connection for live streaming
    const source = new EventSource(response.redirect);

    source.onopen = function(event) {
        //console.log("EventSource connection opened:", event);
    };

    source.onmessage = function(event) {
        //console.log("Raw data received:", event.data);
        
        try {
            // Assuming data contains a 'message' field. Modify as needed.
            const message = JSON.parse(event.data).content;    
            // Update the content of the card with the insertedId
            callback(message)

        } catch (e) {
            console.error("Error parsing received data:", e);
        }
    };

    source.addEventListener('end', function(event) {

        const data = JSON.parse(event.data);

        if (endCallback) endCallback(data);

        source.close();

    });

    source.onerror = function(error) {
        console.error("EventSource failed:", error);
        if (endCallback) endCallback(data);
        source.close();
    };

    return source;
}

// Keyword Behavior

function handleKeywordsBehavior(){
    if($('#keywords').length == 0){
        return
    }
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

function createListSearch(response){
    console.log(response)
    $.each(response.data, function(index, item) {
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
    })
}