let sourceInstances = {}

$(document).ready(function() {
    handleOpenaiForm();
    handleComparePDF();
    handleVideoForm();
    loopSearchResult();
});

const handleOpenaiForm = () => {

    handleCounterAndAddForm()
    // Check and set the initial state on page load
    handleCheckboxState();
    
    // On checkbox state change
    $('#aiCheckbox').change(handleCheckboxState);
    
    let initialFormData = new FormData($('form#ebook')[0]);
    
    $('form#summarizePDF').submit(function(e){

        e.preventDefault();

        let formData = new FormData(this);

        if (!checkFormChange(initialFormData, formData)) {
            alert('フォームに変更はありません。');
            return
        }
        
        const $buttonContainer = $(this).find('button[type="submit"]')
        const $spinner = showSpinner($buttonContainer,'summarizePDF')
        
        // simulate request
        $.ajax({
            url: '/api/openai/custom/summarizePDF', // replace with your endpoint
            method: 'POST',
            data: formData,
            processData: false, // Tell jQuery not to process data
            contentType: false, // Tell jQuery not to set contentType
            success: function(response) {
                if (response.insertedId) {
                    handleStream(response, function(message) {
                        const containerID = `card-${response.insertedId}`;
                        if($('#'+containerID).length == 0) {   
                            // Create an initial card with the insertedId as an identifier
                            const initialCardHtml = `<div class="card mb-3" id="${containerID}"><div class="card-body"></div></div>`;
                            $('#result').prepend(initialCardHtml);
                            console.log(`Initial card created with id: card-${containerID}`);
                        }   
                        $(`#${containerID} .card-body`).append(message);
                    });
                    
                } else {
                    const agent_message = response.completion;
                    console.log({ agent_message });

                    var cardsHtml = agent_message.map(function(message) {
                        return '<div class="card mb-3"><div class="card-body">' + message + '</div></div>';
                    }).join('');

                    $('#result').prepend(cardsHtml);
                }

                $spinner.hide();
                $buttonContainer.find('i').show();
            },
            error: function(error) {
                console.error(error);
                $spinner.hide();
                $buttonContainer.find('i').show();
            }
        });


    })
    $('form#snsContent').submit(function(e){

        e.preventDefault();

        let formData = new FormData(this);
        console.log(formData)

        if (!checkFormChange(initialFormData, formData)) {
            alert('フォームに変更はありません。');
            return
        }
        
        const snsChoice = $('#snsChoice').val()
        const language = $('#language').val()
        const message = $('#message').val() || ''
        const keywordsArray = formDataArray('keyword') ;
        const postCount = $('#postCount').val()
        const data = {snsChoice,language,message,keywordsArray,postCount}
        if(keywordsArray.length==0  || !message){
            alert('申し訳ありませんが、フォームを送信する前に全ての必須項目をご記入ください。')
            return
        }
        const $buttonContainer = $(this).find('button[type="submit"]')
        const $spinner = showSpinner($buttonContainer,'sns')


        // Constructing the GPT-3 prompt using the collected data
        const gpt3Prompt = `
        I am looking to craft an engaging post for ${snsChoice}. \nThe primary language of my audience is ${language}. Write the post in ${language}.\n${message!=''?`The core message I want to convey is: "${message}"`:''}. \n${keywordsArray.length>0?`To give you more context, here are some keywords related to my post: ${keywordsArray.join(', ')}. `:''}\n\nAnd, I'd like to possibly integrate hashtags.\n\nRespond with the post only, no coments,no translation if not asked !
        `;
        generateStream('sns',gpt3Prompt,data,function(response){
            for(let i = 1; i <= postCount; i++) {
                (function(index) {handleStream(response, function(message) {
                    const containerID = generateCard(response,index)
                    $(`#${containerID} .card-body p`).append(message);
                  },function(data){
                  });
                })(i);
            }

            $spinner.hide();
            $buttonContainer.find('i').show();

        },function(){
            $spinner.hide();
            $buttonContainer.find('i').show();
        })

    })
    $('form#blogPost').submit(function(e){

        e.preventDefault();

        let formData = new FormData(this);
        console.log(formData)

        if (!checkFormChange(initialFormData, formData)) {
            alert('フォームに変更はありません。');
            return
        }
        
        const language = $('#language').val()
        const title = $('#title').val()
        const subtitle = $('#subtitle').val()
        const keywordsArray = formDataArray('keyword') ;
        const data = {language, title,subtitle,keywordsArray}
        if(keywordsArray.length==0  || !title || !subtitle){
            alert('申し訳ありませんが、フォームを送信する前に全ての必須項目をご記入ください。')
            return
        }
        const $buttonContainer = $(this).find('button[type="submit"]')
        const $spinner = showSpinner($buttonContainer,'article')


        // Constructing the GPT-3 prompt using the collected data
        const gpt3Prompt = `
        Write a chapter for the following blog post :
        Language:  ${language}. 
        Title: "${title}"
        Subtitle: "${subtitle}"
        Relevant keywords: ${keywordsArray.join(', ')}
        Note: Respond using markdown and provide the post content only—no comments, no translations unless explicitly requested.
        `;        
        generateStream('article',gpt3Prompt,data,function(response){
            handleStream(response, function(message) {
                const containerID = `card-${response.insertedId}`;
                if($('#'+containerID).length == 0) {   
                    // Create an initial card with the insertedId as an identifier
                    const initialCardHtml = `<div class="card mb-3"><div id="${containerID}" class="card-body"></div></div>`;
                    const initialCardHtmlOutput = `<div class="card mb-3"><div id="${containerID}-output" class="card-body"></div></div>`;
                    $('#result').prepend(initialCardHtml);
                    $('#htmlOutput').prepend(initialCardHtmlOutput);
                    console.log(`Initial card created with id: card-${containerID}`);
                }   
                watchAndConvertMarkdown(`#${containerID}`, `#${containerID}-output`); 
                $(`#${containerID}`).append(message);
            });

            $spinner.hide();
            $buttonContainer.find('i').show();

        },function(){
            $spinner.hide();
            $buttonContainer.find('i').show();
        })

    })
    $('#compare').submit(function(e){
        e.preventDefault();
        
        const input1 = $('#input1').val()
        const input2 = $('#input2').val()
        const data = {input1, input2}
        if(!input1 || !input2){
            handleFormResult(false,'内容を入力してください。')
            return
        }
        const $buttonContainer = $(this).find('button[type="submit"]')
        const $spinner = showSpinner($buttonContainer,generateRandomID())


        // Constructing the GPT-3 prompt using the collected data
        const gpt3Prompt = `
        Compare the following inputs :
        input1: ${input1}\n\n
        input2: ${input2}
        Tell me what is the difference ?
        Note: Respond using markdown and provide the post content only—no comments, no translations unless explicitly requested.
        `;        
        generateStream('compare',gpt3Prompt,data,function(response){
            handleStream(response, function(message) {
                const containerID = `card-${response.insertedId}`;
                if($('#'+containerID).length == 0) { 
                    const containerID = generateCard(response)
                    watchAndConvertMarkdown(`#outputTemp`, `#${containerID} .card-body p`); 
                }   
                $(`#outputTemp`).append(message);
            });

            $spinner.hide();
            $buttonContainer.find('i').show();

        },function(){
            $spinner.hide();
            $buttonContainer.find('i').show();
        })

    })
}
const handleComparePDF = () => {
    $('form#comparePDF').on('submit', function(e) {
        e.preventDefault();

        let formData = new FormData(this);
        console.log(formData);

        const $this = $(this).find('button[type="submit"]');

        $this.find('i').hide(); // hide plane icon
        $this.append('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>'); // add spinner

        // simulate request
        $.ajax({
            url: '/api/openai/pdf/compare', // replace with your endpoint
            method: 'POST',
            data: formData,
            processData: false, // Tell jQuery not to process data
            contentType: false, // Tell jQuery not to set contentType
            success: function(response) {

                console.log(response);
                $this.find('.spinner-border').remove(); // remove spinner
                $this.find('i').show(); // show plane icon

                // Create a table
                let table = $('<table>').addClass('table table-striped');

                // Create table header
                let thead = $('<thead>').addClass('black white-text');
                let headerRow = $('<tr>');
                headerRow.append($('<th>').text('入力1'));
                headerRow.append($('<th>').text('入力2'));
                headerRow.append($('<th>').text('差分'));
                thead.append(headerRow);
                table.append(thead);

                // Create table body
                let tbody = $('<tbody>');

                for(let item of response.completion){
                    let row = $('<tr>');
                    row.append($('<td>').text(item.input1));
                    row.append($('<td>').text(item.input2));
                    row.append($('<td>').text(item.difference));
                    tbody.append(row);
                }

                table.append(tbody);

                // Append the table to the result div
                $('#result').empty().append(table);

            },
            error: function(error) {
                console.error(error);
                handleFormResult(false, '比較中にエラーが発生しました') 
                $this.find('.spinner-border').remove(); // remove spinner
                $this.find('i').show(); // show plane icon
            },
            finally: function(error) {
                console.error(error);
                handleFormResult(false, '比較中にエラーが発生しました') 
                $this.find('.spinner-border').remove(); // remove spinner
                $this.find('i').show(); // show plane icon
            }
        });
    });

}
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
        const postCount = 3;  // Process only the first two elements
    
        for(let i = 0; i < postCount; i++) {
            (function(index) {
                const cardId = containers.eq(index).data('id');
                $.get('/api/video?videoId='+cardId, function(response) {
                    console.log('Summarize: ', response.data._id);
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