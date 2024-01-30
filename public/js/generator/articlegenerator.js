$(document).ready(function(){
    $('form#article-generator').on('submit',function(e){
        e.preventDefault()
        submitForm($(this));
    });
    var sectionId = getQueryParam('id');
    $.get('/api/sectiongenerator/sectiondata?sectionId='+sectionId,function(data){
        if (data) {
            $('#title').val(data.request.TITLE);
            $('#sections').val(data.completion).attr('data-sections',data.completion);
        }
    })

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
    $(`button#generate-${type} .text`).text('Loading ...');
    let sections = $('#sections').attr('data-sections')
    sections = sections.trim().split(',').filter(title => title.length);
    
    for (let [index, section] of sections.entries()) {
        var data = {
            SECTION : section,
            TITLE : $('#title').val(),
            WRITING_STYLE : $('#writingStyle').val(),
            LANGUAGE : $('#language').val(),
            WRITING_TONE : $('#writingTone').val(),
            index
        };

        handleFormSubmit(type,data);
    }
}

function handleFormSubmit(type, data) {
    generateStream(type, data, handleStreamSuccess(type, data), handleStreamError(type), handleStreamFinally(type));
}

function handleStreamSuccess(type, data) {
    return function(response) {
        handleStream(response, appendMessageToContainer(type, data, response), handleStreamEnd(type, data,response));
    };
}

function appendMessageToContainer(type, data, response) {
    return function(message) {
        const containerID = `response-${type}-${response.insertedId}-${data.index}`;
        if ($(`#${containerID}`).length == 0) {
            const initialCardHtml = `
                <div class="card mb-3">
                    <div class="card-body">
                        <div id=${containerID}></div>
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
        const containerID = `response-${type}-${response.insertedId}-${data.index}`;
        convertMarkdown(`#${containerID}`);
        udpateSendButton(containerID,completionId)
    };
}

function handleStreamError(type) {
    return function() {
        updateUIAfterStream(type);
    };
}

function handleStreamFinally(type) {
    return function() {
        updateUIAfterStream(type);
    };
}

function updateUIAfterStream(type) {
    $(`form#${type}-generator`).removeClass('busy');
    $(`#generate-${type} .text`).text('提案されるトピック');
}

function udpateSendButton(containerID,completionId){
    if($(`.send-${containerID}`).length == 0){
        $('#result').append(`<a class="w-100 btn btn-primary send-${containerID}" target="_blank">Post article</a>`)
        $(`.send-${containerID}`).attr('href',`/dashboard/app/postarticle?id=${completionId}`)
    }
}

function convertMarkdown(sourceSelector) {
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
        url: '/api/articlegenerator/generate/' + type, // Replace with your endpoint
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