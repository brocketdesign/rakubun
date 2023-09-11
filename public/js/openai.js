let sourceInstances = {}

$(document).ready(function() {
    handleVideoForm();
});

const handleVideoForm = () => {
    handleOpenaiFormSubmission('#video-summarize','summarize')
    handleOpenaiFormSubmission('#video-snsContent','snsContent')
    handleOpenaiFormSubmission('#video-qa','qa')
    handleOpenaiFormSubmission('#video-important','important')   
}
function handleOpenaiFormSubmission(formSelector, apiEndpoint, additionalCallback) {
    $(formSelector).submit(function(event) {
        event.preventDefault();
        const formData = new FormData(this);
        let postCount = parseInt(formData.get('postCount')) || 1
        const videoId = $('#video-holder').data('id')
        const $buttonContainer = $(this).find('button[type="submit"]')
        const $spinner = showSpinner($buttonContainer,'summarize')

        if (shouldPreventSubmission($buttonContainer,$spinner,sourceInstances)) { 
            return; 
        }
    
        $buttonContainer.addClass('done');
    
        $.ajax({
            url: `/api/openai-video/${apiEndpoint}?videoId=${videoId}`,
            method: 'POST',
            data: formData,
            processData: false, // Tell jQuery not to process data
            contentType: false, // Tell jQuery not to set contentType
            success: function(response) {
        
                for(let i = 1; i <= postCount; i++) {
                    (function(index) {
                        let containerID = `card${response.insertedId}${generateRandomID()}`;
                        console.log(`Loop ${index}/${postCount}`)

                        const resultContainer = $(formSelector).find('.result')
                        const tempResultContainer = $(formSelector).find('.result-temp')
                    
                        if($('#' + containerID).length == 0) {
                            const initialCardHtml = designCard(containerID,response)
                            const initialCardHtmlTemp = designCard(containerID+'temp',response)

                            resultContainer.prepend(initialCardHtml);
                            tempResultContainer.prepend(initialCardHtmlTemp);
        
                            updateMoments();
                            console.log(`Initial card created with id: card-${containerID}`);
                        }
                    
                        let source =  handleStream(response, function(message) {
   
                            $(`#${containerID}temp .card-body p`).append(message);
                            //$(`#${containerID} .card-body p`).append(message);
                            watchAndConvertMarkdown(`#${containerID}temp .card-body p`, `#${containerID} .card-body p` ); 
                            if (additionalCallback) additionalCallback(response, message);
                        },function(endMessage){
                            if(index<=1){
                                resetButton($spinner,$buttonContainer)
                            }
                        });
                        // Store the source instance for this generation
                        sourceInstances[generateRandomID()] = source
                    })(i);
    
                }
    
            },
            error: function(error) {
                console.error(error);
                resetButton($spinner,$buttonContainer)
            },
            finally: function(error) {
                console.error(error);
                resetButton($spinner,$buttonContainer)
            }
        });
    });
}
function loopSearchResult(){
    if(document.querySelector('.summary')){
        const containers = $('.info-container');
        const postCount = 10;  // Process only the first two elements
    
        for(let i = 0; i < postCount; i++) {
            (function(index) {
                const cardId = containers.eq(index).data('id');
                $.get('/api/video?videoId='+cardId, function(response) {
                    handleAutoOpenai(cardId,response.data._id);
                })
            })(i);
        }
    }
}
function isAlreadySummarized(videoId,callback){
    $.get(`/api/video?videoId=${videoId}`,function(result){
        if(result && result.data && result.data.openai && result.data.openai['short-summarize']){
            callback(result.data.openai['short-summarize'])
        }else{
            callback(false)
        }
    })
}
function handleAutoOpenai(cardId,videoId,additionalCallback){
    isAlreadySummarized(videoId,function(iSummarized){
        if(iSummarized){
            const containerID = 'card-'+generateRandomID()
            const resultContainer = $(`.summary[data-id=${cardId}]`)
            const tempResultContainer = $(`.summary-temp[data-id=${cardId}]`)
            const initialCardHtml = designCard(containerID,{insertedId: containerID})
            const initialCardHtmlTemp = designCard(containerID+'temp',{insertedId: containerID})
            resultContainer.prepend(initialCardHtml);
            tempResultContainer.prepend(initialCardHtmlTemp);
            watchAndConvertMarkdown(`#${containerID}temp .card-body p`, `#${containerID} .card-body p` ); 
            appendHeadlineCharacterByCharacter($(`#${containerID}temp .card-body p`), iSummarized,function(){
            })
            return 
        }
        $.ajax({
            url: `/api/openai-video/short-summarize?videoId=${videoId}`,
            method: 'POST',
            data: {language:'en'},
            success: function(response) {
        
                let containerID = `card${response.insertedId}${generateRandomID()}`;
                containerID = `card${response.insertedId}${generateRandomID()}`;
    
                const resultContainer = $(`.summary[data-id=${cardId}]`)
                const tempResultContainer = $(`.summary-temp[data-id=${cardId}]`)
            
                if($('#' + containerID).length == 0) {
                    const initialCardHtml = designCard(containerID,response)
                    const initialCardHtmlTemp = designCard(containerID+'temp',response)
    
                    resultContainer.prepend(initialCardHtml);
                    tempResultContainer.prepend(initialCardHtmlTemp);
    
                    updateMoments();
                    console.log(`Initial card created with id: card-${containerID}`);
                }
            
                let source =  handleStream(response, function(message) {
    
                    $(`#${containerID}temp .card-body p`).append(message);
                    //$(`#${containerID} .card-body p`).append(message);
                    watchAndConvertMarkdown(`#${containerID}temp .card-body p`, `#${containerID} .card-body p` ); 
                    if (additionalCallback) additionalCallback(response, message);
                },function(endMessage){
                });
                // Store the source instance for this generation
                sourceInstances[generateRandomID()] = source
            },
            error: function(error) {
                console.error(error);
            },
            finally: function(error) {
                console.error(error);
            }
        });
    })


}
function resetButton($spinner,$buttonContainer){
    $spinner.hide()
    $buttonContainer.find('i').show();
    $buttonContainer.removeClass('done bg-danger stop')
    $buttonContainer.find('.content').text('生成する')
}
function shouldPreventSubmission($buttonContainer,$spinner,sourceInstances) {
    if ($buttonContainer.hasClass('stop')) {
        if(!isEmpty(sourceInstances)){
            stopStreams(sourceInstances)
        }
        resetButton($spinner,$buttonContainer)
        return true;
    }
    $buttonContainer.addClass('bg-danger stop')
    $buttonContainer.find('.content').text('生成停止')
    return false;
}
function designCard(containerID,doc){
    return `<div class="card mb-3" id="${containerID}" data-id="${doc.insertedId}">
    <div class="card-top p-3 d-flex align-items-center justify-content-between">
    <div class="tools d-flex align-items-center">
    <a class="btn tool-button share mx-2" onclick="handleShareButton(this)" data-toggle="tooltip" title="Twitterでシェア"><i class="fas fa-share-alt"></i></a>
    <badge class="btn tool-button tool-button-copy mx-2" data-toggle="tooltip" title="コピー"><i class="fas fa-copy"></i></badge>
    <badge class="btn tool-button tool-button-post mx-2" data-toggle="tooltip" title="Post"><i class="fas fa-plane"></i></badge>
    </div><div class="text-end text-sm text-muted" style="font-size:12px"><div class="custom-date" data-value="${new Date()}"></div></div></div><div class="card-body py-0"><p></p></div></div>`;
}
function generateRandomID() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    
    for (let i = 0; i < 8; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      result += characters[randomIndex];
    }
    
    return result;
}
function generateCard(response,index=1) {
    const containerID = `card-${response.insertedId}-${index}`;
    if ($('#' + containerID).length == 0) {
        const initialCardHtml = `
        <div class="card mb-3" id="${containerID}" data-id="${response._id}">
            <div class="card-top p-3 d-flex align-items-center justify-content-between">
            <div class="tools d-flex align-items-center">
                <a class="btn tool-button share mx-2" onclick="handleShareButton(this)" data-toggle="tooltip" title="Twitterでシェア">
                <i class="fas fa-share-alt"></i>
                </a>
                <badge class="btn tool-button tool-button-copy mx-2" data-toggle="tooltip" title="コピー">
                <i class="fas fa-copy"></i>
                </badge>
                <badge class="btn tool-button tool-button-post mx-2" data-toggle="tooltip" title="Post">
                <i class="fas fa-plane"></i>
                </badge>
            </div>
            <div class="text-end text-sm text-muted" style="font-size:12px">
                <div class="custom-date" data-value="${new Date()}"></div>
            </div>
            </div>
            <div class="card-body py-0">
            <p></p>
            </div>
        </div>`;

        $('#result').prepend(initialCardHtml);
        updateMoments();
        console.log(`Initial card created with id: card-${containerID}`);
    }
    return containerID
}
function isEmpty(obj) {
    return JSON.stringify(obj) === '{}';
}