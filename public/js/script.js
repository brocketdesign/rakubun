// Utility functions
const logout = () => window.location.href = '/user/logout';
const YOUR_LARGE_SCREEN_BREAKPOINT = 992

const checkFormChange = (initialData, form) => {
    return Array.from(form.entries()).some(([name, value]) => value !== initialData.get(name));
}

const inputTrigger = (inputElement, triggerElement) => {
    triggerElement.addEventListener('click', () => inputElement.click());
}
$(document).ready(function() {
    handleEvents()
    handleUserProfile();

    handleCopyButtons()
    updateMoments();
    enableTrackScroll();

    onLargeScreen(handleSideBar)
    onSmallScreen(handleSideBar2)
    
    handleAccordions()
    
    handleScrollDownButton();
    handleCardClickable();

    handleDownloadButton();
    handleCardButton();
    handleMemo();

    handleLoadMore();
    handleResetFormSubmission();
    feather.replace()
});
function scrollBottomWindow(){
    $('html, body').animate({ scrollTop: $(document).height() }, 'fast', function() {
        // After the animation is complete, disable scrolling
        $('body').css('overflow', 'hidden');
    });
}
const handleScrollDownButton = () => {
    if ($('#chat-input-section').length) {
        scrollBottomWindow()
        $('.chat-window').animate({ scrollTop: $('.chat-window')[0].scrollHeight }, 'slow');
        disableTrackScroll()
    }
    
    // Detect scroll event on the chat window
    $('.chat-window').on('scroll', function() {
        // If scrolled to bottom of the chat window, fade out the scroll down button
        if ($('.chat-window').scrollTop() + $('.chat-window').innerHeight() >= $('.chat-window')[0].scrollHeight) {
            $('.scroll-down').fadeOut();
        } else {
            // If not at the bottom, fade in the scroll down button
            $('.scroll-down').fadeIn();
        }
    });
    $('.scroll-down').on('click', function() {
        $('.chat-window').animate({ scrollTop: $('.chat-window')[0].scrollHeight }, 'slow');
        return false;
    });
}

const handleCardButton = () => {
    $(document).on('click','.info-button',function(){
        $(this).closest('.card-body').find('.card-title').toggle()
    })
}
// This function checks password fields if they exist
const validatePasswordFields = async formData => {
    // Extract password data from formData
    const oldPassword = formData.get("userOldPassword");
    const newPassword = formData.get("userPassword");
    const newPasswordVerification = formData.get("userPasswordVerification");

    if (oldPassword) {
        if (!await isOldPasswordCorrect(oldPassword)) {
            return '古いパスワードが正しくありません';
        }
    }

    if (newPassword && newPasswordVerification) {
        if (!areNewPasswordsSame(newPassword, newPasswordVerification)) {
            return '新しいパスワードとパスワードの確認が一致しません';
        }
    } else if (newPassword || newPasswordVerification) {
        // Only check if both fields are filled if one of them is filled
        return 'すべてのパスワードフィールドを入力してください';
    }

    return null; // Return null if there's no error
};

// This function handles form submission
const handleFormSubmission = async formData => {
    const passwordError = await validatePasswordFields(formData);

    if (passwordError) {
        handleFormResult(false, passwordError);
        return;
    }

    $.ajax({
        url: `/user/updateProfile`,
        type: 'POST',
        enctype: 'multipart/form-data',
        data: formData,
        processData: false, // Tell jQuery not to process data
        contentType: false, // Tell jQuery not to set contentType
        success: handleFormSuccess,
        error: handleFormError
    });
};

const isOldPasswordCorrect = async (oldPassword) => {
    let isCorrect = false;
  
    await $.ajax({
        url: `/user/isOldPasswordCorrect`,
        type: 'POST',
        data: { oldPassword: oldPassword },
        success: (response) => {
            isCorrect = response.isMatch;
        },
        error: (jqXHR, textStatus, errorThrown) => {
            console.log('Error in password validation: ', textStatus, errorThrown);
        }
    });
  
    return isCorrect;
};

const areNewPasswordsSame = (newPassword,newPasswordVerification) => {
    return newPassword === newPasswordVerification;
};

const handleFormSuccess = response => {
    if (response.status === 'success') {
        handleFormResult(true, response.message);
    } else {
        handleFormResult(false, response.message);
    }
}

const handleFormError = (jqXHR, textStatus, errorThrown) => {
    console.log('予期せぬエラーが発生しました。')
    handleFormResult(false, '予期せぬエラーが発生しました。');
}

const handleFormResult = (isSuccess, message) => {
    let btnColor = isSuccess ? 'success' : 'danger';
    let btnSelector = `button[type="submit"]`;

    //$(btnSelector).removeClass('btn-success').addClass(`btn-${btnColor}`);

    $("#front-alert .alert-success").stop().hide();
    $("#front-alert .alert-danger").stop().hide();

    $("#front-alert .alert-"+btnColor).text(message).fadeIn().delay(5000).fadeOut();

    //setTimeout(() => $(btnSelector).removeClass(`btn-${btnColor}`).addClass('btn-success'), 5000);
}

// Handling of card clicking
const handleCardClickable = () => {
    $(`.card-clickable-1 img`)
    .click(function() {
    const $thisCard = $(this).parent()
    var id = $thisCard.data('id');
    var isdl = $thisCard.data('isdl');

    console.log('Clicked card ID:', id);
    console.log('isdl: ',isdl)

      // Check if the card has already been processed
      if ($thisCard.hasClass('done')) {
          console.log('Card has already been processed.');
          return;
      }

      //Reset all the other cards
      $(`.card-clickable-1`).each(function(){
        $(this).removeClass('done')
      })
      // Mark the card as done to avoid processing it again
      $thisCard.addClass('done');

      // Check if the spinner is already present, if not, create and append it to the card
      if (!$thisCard.find('.spinner-border .for-strm').length) {
          var $spinner = $('<div>').addClass('spinner-border for-strm position-absolute bg-dark').css({inset:"0px", margin:"auto"}).attr('role', 'status');
          var $span = $('<span>').addClass('visually-hidden').text('読み込み中...');
          $spinner.append($span);
          $thisCard.find('.card-body-over').append($spinner);
      }

      // Show the spinner while the download is in progress
        $thisCard.find('.card-body-over').show();
      var $spinner = $thisCard.find('.spinner-border');
      $spinner.show();

      // Make a request to the server to get the highest quality video URL for the given ID
      $.get('/api/video?videoId='+id, function(response) {
          console.log('API Response:', response);

        // Hide the spinner

        $thisCard.find('.card-body-over').hide();
        $spinner.hide();
          // Assuming the response from the API is a JSON object with a 'url' property
          if (response && response.url) {
              console.log('Received video URL:', response.url);

              // Replace the image with an autoplay video
              var $video = $('<video>').attr({
                  src: response.url,
                  autoplay: true,
                  width:"100%",
                  controls: true,
                  playsinline: true
              }).on('loadeddata', function() {
                // Code to be executed when the video is ready to play
                console.log('Video ready to play');
            });
            console.log('Video element created:', $video);
            //$thisCard.find('.card-img-top').remove()
            
            // Update the card body with the new video
            //$thisCard.prepend($video);
            $('#video-holder').html('')
            $('#video-holder').data('id',id)
            $('#video-holder').append($video)//.append($thisCard.find('.tool-bar').clone()).append($thisCard.find('.card-title').clone().show())
            
            //scrollToTop();

            $('#mobile-toolbar').html('')
            const cardClone = $thisCard.clone()
            cardClone.find('.card-top').remove()
            cardClone.find('img').remove()
            cardClone.find('.card-title').text().length > 0 ? cardClone.find('.card-title').show() : cardClone.find('.card-title').hide()
            cardClone.find('.card-body-over').remove()
            cardClone.find('.card-body').show()
            cardClone.find('.card-body').removeClass('position-absolute px-3')
            cardClone.find('.text-white').each(function(){
                $(this).removeClass('text-white')
            })

            $('#video-holder').append(cardClone)

            $('#mobile-toolbar').append(cardClone.clone())
       
            //displaySummary(response)
            $('#summary').show()
   
              $('#video-container').show()
              //$thisCard.hide()
              console.log('Video added to card body.');

              //Add related
              if(response.related){
                $('#related').html('')
                $cardContainer = $('.card.card-clickable-1').clone()
                for(item in response.related){
                    $spinner = $cardContainer.find('.spinner-border');
                    $spinner.hide()
                    $cardContainer.addClass('item m-2').style('width','18rem')
                    $cardContainer.attr('data-id',item._id).attr('data-title',item.alt)
                    $cardContainer.find('src').attr('src',item.imageUrl)
                    $cardContainer.find('a.source').attr('href',item.href)
                    $cardContainer.find('p.card-title').text(item.alt)
                    
                    $('#related').append($cardContainer)
                }
                handleCardClickable()
              }

            if (isdl==false && response.url.includes('http')) {
                // Add the download button
                var $downloadButton = $thisCard.find('.download-button')
                $downloadButton.show()
                console.log('Download button added to card body.');
            }
                
          } else {
              // If the response does not contain a URL, show an error message or handle it as needed
              console.error('Error: Video URL not available.');

              $thisCard.find('.card-body-over').hide();
              // Hide the spinner if there's an error
              $spinner.hide();
          }
      });
  });
}
function displaySummary(response) {
    $('#summary .content').html('')
    if(response && response.data && response.data.summary && response.data.summary.length > 0){
        if($('#summary-content').length == 0){
            const initialCardHtml = `<div class="card mb-3" id="summary"><div class="card-body"></div></div>`;
            const initialCardHtmlMobile = `<div class="card mb-3" id="summary-content"><div class="card-body"></div></div>`;
            $('#summary .content').prepend(initialCardHtml);
            $('#mobile-toolbar').append(initialCardHtmlMobile);
        }
        $('#summary .card-body').append(response.data.summary)
        $('#mobile-toolbar #summary-content .card-body').append(response.data.summary)
    }
}
// Handling of download button clicking
const handleDownloadButton = () => {
  $(document).on('click', '.download-button', function(event) {
    event.preventDefault(); // Prevents the default click behavior

    var id = $(this).data('id') || $(this).closest('.info-container').data('id');
    var title = $(this).data('title') || $(this).closest('.info-container').data('title');

    console.log('Download button clicked for:', {id,title});
    var $buttonContainer = $(this);

      // Check if the card has already been processed
      if ($buttonContainer.hasClass('done')) {
        handleFormResult(false, '既にダウンロードされています') 
          console.log('Card has already been processed.');
          return;
      }

      // Mark the card as done to avoid processing it again
      $buttonContainer.addClass('done');

      const DLicon = $buttonContainer.find('i').clone();
      $buttonContainer.html('');

      // Check if the spinner is already present, if not, create and append it to the card
      if (!$(this).find('.spinner-border.for-dl').length) {
          var $spinner = $('<div>').addClass('spinner-border for-dl spinner-border-sm').attr('role', 'status');
          var $span = $('<span>').addClass('visually-hidden').text('読み込み中...');
          $spinner.append($span);
          $(this).prepend($spinner);
      }

      // Show the spinner while the download is in progress
      var $spinner = $(this).find('.spinner-border');
      $spinner.show();

      // Make a request to download the video
      $.post('/api/dl', { video_id: id ,title}, function(response) {
        console.log('Download API Response:', response);

        $spinner.remove();

        if(!$buttonContainer.find('i').length){
          $buttonContainer.append(DLicon)
        }
        console.log('download successful.');
        handleFormResult(true, response.message)    
        
      }).fail(function() {

        $spinner.remove();
        $buttonContainer.removeClass('done');
        console.error('Error occurred while downloading file.');
        if(!$buttonContainer.find('i').length){
          $buttonContainer.append(DLicon)
        }

        console.error('Error: Video download failed.');
        handleFormResult(false, 'Video Downloaded failed') 
        // Hide the spinner in case of an error
        $spinner.hide();
      });
  });
}

const handleHiding = (videoId) => {
    let $container = $(`.card[data-id=${videoId}]`)
    $.ajax({
        url: '/api/hide',
        method: 'POST',
        data: { element_id: videoId },
        success: function(response) {
            $container.remove()
            handleFormResult(true,response.message)
            // Handle the success response
            console.log(response);
            },
        error: handleFormError
    });

}

const handleHidingHistory = (query) => {
    console.log(`Hide this query : ${query}`)
    $.ajax({
        url: '/api/hideHistory',
        method: 'POST',
        data: { query: query },
        success: function(response) {
            handleFormResult(true,response.message)
            // Handle the success response
            console.log(response);
            },
        error: handleFormError
    });
}
function updategridlayout(value) {
    // Function implementation goes here
    // This function will be called when the range input is changed
    // You can update the grid layout or perform any other actions based on the 'value'
  
    // Remove any existing col- classes from grid items
    $('.grid-item').removeClass(function (index, className) {
      return (className.match(/(^|\s)col-\S+/g) || []).join(' ');
    });
  
    // Calculate the column width class based on the range value
    const colClass = `col-${12 / value}`;
  
    // Add the new col- class to each grid item
    $('.grid-item').addClass(colClass);
  }
  
  
  const handleGridRange = () => {
    if($('#range').data('mode')==1 && $(window).width() <= 768){
        $('#grid-range').val(1);
        updategridlayout(1)
        $('#range').hide()
        return
    }
    if($('#range').data('mode')== 1 && $(window).width() > 768){
        $('#grid-range').val(2);
        updategridlayout(2)
        $('#range').hide()
        return
    }
    // Check if the local variable exists
    var rangeState = localStorage.getItem('rangeState');
  
    // Initialize the range input based on the local variable
    if (rangeState !== null) {
      $('#grid-range').val(rangeState);
      updategridlayout(rangeState)
    }
  
    // Save the state of the range input to local storage when it's toggled
    $('#grid-range').change(function() {
      const value = $(this).val();
      localStorage.setItem('rangeState', value);
      updategridlayout(value); // Call the function to update the grid layout with the new value
    });
  };
  
  const handleLoadMore = () => {
    const currentPage = $('#page').val()
    if(currentPage==1){
        $('.load-more-previous').remove()
    }
    $('form#search').on('submit',function(e){
        e.preventDefault()
        
        const formData = new FormData(this);
        const searchdata = $('form#search').data();
        
        // Convert FormData to a plain object
        let formDataObject = {};
        for (let [key, value] of formData.entries()) {
          formDataObject[key] = value;
        }
        
        // Combine searchdata and formDataObject
        const data = Object.assign(searchdata, formDataObject);

        const $buttonContainer = $('form#search').find('button[type="submit"]')
        const $spinner = showSpinner($buttonContainer,'loadmore')

        sendSearchForm(data,function(){
            $spinner.hide();
            $buttonContainer.find('i').show();
        })
    })
    $('.load-more').on('click', function(){
        const data = $(this).data()

        const $buttonContainer = $(this)
        const $spinner = showSpinner($buttonContainer,'loadmore')

        sendSearchForm(data,function(){
            $spinner.hide();
            $buttonContainer.find('i').show();
        })
    })
  }
  function sendSearchForm(data,callback) {
    $.ajax({
        url: `/api/loadpage`,
        type: 'POST',
        data,
        success: function(response){
            const url =`/dashboard/app/${data.mode}?page=${parseInt(data.page)}&searchTerm=${data.searchterm?data.searchterm:data.searchTerm}&nsfw=${data.nsfw}`
            console.log(url)
            if(callback){callback()}
           window.location=url
        },
        error: handleFormError
    });
}
  const handleResetFormSubmission = () => {
    $('form#reset-form').on('submit', function(e) {
        e.preventDefault();
        const confirmation = confirm("Are you sure you want to reset? This action cannot be undone.");

        if (confirmation) {
            $.ajax({
                url: `/user/reset`,
                type: 'POST',
                data: {mode:$('#mode').val()},
                success: handleFormSuccess,
                error: handleFormError
            });
        }
    }); 
}

// Function to search subreddits
function searchSubreddits(el) {
    // Checking if the element does not have a 'wait' class
    if (!$(el).hasClass('wait')) {
  
      // Adding 'wait' class to the element
      $(el).addClass('wait')
  
      // Implementing a delay using setTimeout
      setTimeout(async () => {
  
        // Clearing the content of 'searchRes' and adding a loading indicator
        $('#searchRes').empty().append(`
          <li class="list-group-item loading text-center p-3">
            <div class="loader spinner-border">
              <span class="visually-hidden">Loading ...</span>
            </div>
          </li>
        `);
  
        // Getting the search key from the element's value
        const key = $(el).val();
  
        // Forming the API URL
        const apiUrl = `/api/searchSubreddits?query=${key}`;
  
        // Checking if key is not empty and is more than 0 characters long
        if (key && key.length > 0) {
  
          // Fetching data from the API
          try {
            const response = await $.get(apiUrl);
  
            // Mapping over the response data and forming the content
            const content = response.map(element => {
              const url = encodeURIComponent(`https://www.reddit.com${element['url']}new/.json?count=25&after=`);
              return `
                <li class="list-group-item btn text-start">
                  <span data-title="${element['title']}" data-url="${url}" data-value="${element['url']}" onclick="searchFor(this)">
                    ${element['title']}
                  </span>
                  <span class="bg-danger badge float-end r18 ${element.r18}">
                    R18
                  </span>
                </li>
              `;
            }).join('');
            // Removing the loading indicator and appending the content
            $('#subRedditSearchRes').append(content);
          } catch (error) {
            console.error(error);
          }
        } else {
          // If key is empty, clearing the content of 'searchRes'
          $('#subRedditSearchRes').empty();
        }
  
        // Removing the 'wait' class from the element
        $(el).removeClass('wait');
  
      }, 1000);
    }
  }
function handleBookEditing(){
    $('#edit-book textarea').on('input', function() {
        $(this).css('height', 'auto');
        $(this).css('height', $(this).prop('scrollHeight') + 'px');
    });
    $('#edit-book textarea').each(function() {
        $(this).css('height', 'auto');
        $(this).css('height', $(this).prop('scrollHeight') + 'px');
    });
    $(document).on('change','#edit-book input, #edit-book  textarea',function(){
        const bookID = $('#edit-book').attr('data-id')
        const keyPath = $(this).attr('data-key');
        const newValue = $(this).val();
    
        handleBook({bookID, keyPath, newValue},'edit-book') 
    });
    let lastFocusedInput = null;  // This will store the last focused input or textarea

    $('#edit-book input, #edit-book textarea').on('focus', function() {
        lastFocusedInput = this;  // Save the focused input or textarea
    });
    
    $('#regen').on('click', function() {
        if (lastFocusedInput) {
            $('#regen i').addClass('rotate')
            const bookID = $('#edit-book').attr('data-id');
            const keyPath = $(lastFocusedInput).attr('data-key');
            const newValue = $(lastFocusedInput).val();
            handleBook({bookID, keyPath, newValue},'regen-ebook',function(response){
                console.log(response.data)
                $('#regen i').removeClass('rotate')
                // Assuming response.data contains the new value you want to insert
                $(lastFocusedInput).val(response.data);
            })
            console.log({bookID, keyPath, newValue});
        } else {
            console.log('No input or textarea has been selected.');
        }
    });
    
    
}

  async function handleBook(data,apiKey,callback) {

    $.ajax({
        type: "POST",
        url: "/api/openai/"+apiKey,  // Your API endpoint for updating book info
        data: JSON.stringify(data),
        contentType: "application/json; charset=utf-8",
        dataType: "json",
        success: function(response) {
            // Handle success - maybe a notification to the user
            handleFormResult(true, 'Ebook updated')
            if(callback){
                callback(response)
            }
        },
        error: function(err) {
            // Handle error - notify the user that the update failed
        }
    });
}

  function searchFor(el){
    let url = $(el).data('url')
    let value = $(el).data('value')
    $('#searchTerm').val(value)
    $('form#search').submit()
  }
  function getCurrentPageQueries() {
  // Get the URL parameters
  const queryString = window.location.search;
  const urlParams = new URLSearchParams(queryString);

  // Create an empty object to store the queries
  const queries = {};

  // Loop through each query parameter and add it to the object
  for (const [key, value] of urlParams) {
    queries[key] = value;
  }

  // Return the queries object
  return queries;
}

function scrollToTop() {
    $('html, body').animate({
        scrollTop: 0
    }, 800); // 800 is the duration in milliseconds. You can adjust this value as needed.
}

// Function to handle the appearance of the sidebar menu based on the isSidebarMenuVisible value
function adjustSidebarAppearance(isVisible) {
    if (isVisible) {
        $('#sidebarMenu').find('.hide-text').hide()
        $('#sidebarMenu').find('.collapse').removeClass('show').end()
        //iconAnimation();
        $('#sidebarMenu').animate({ width: '60px' }, 500, function() {
            //$('#sidebarMenu').find('.list-group-item').addClass('text-center');
            $('#sidebarMenu').css("animation", "");
            $('#sidebarMenu').removeClass('open')
            $('#sidebarMenu').fadeOut()
        });
    } else {
        $('#sidebarMenu').fadeIn()
        $('#sidebarMenu').find('.list-group-item').removeClass('text-center').end()
        $('#sidebarMenu').animate({ width: '250px' }, 500, function() {
            $('#sidebarMenu').find('.hide-text').fadeIn();
            //iconAnimation();
            $('#sidebarMenu').addClass('open')
        });
    }

}

// Function to handle toggle click event
function toggleSidebarMenu() {
    adjustSidebarAppearance($('#sidebarMenu').hasClass('open'));
}

function handleSideBar() {
    var isSidebarMenuVisible = JSON.parse(localStorage.getItem('isSidebarMenuVisible') || 'false');

    //$('#sidebarMenuToggle').on('click', toggleSidebarMenu);
    $('#sidebarMenuToggleSmall').on('click', toggleSidebarMenu);
    $('#sidebarMenu').find('li.list-group-item').not('.toggler').on('click', function() {
        if($(this).find('ul').length){
            adjustSidebarAppearance(false);
        }    
        var nextElem = $(this).html();
        // Check if the next element is a link (a tag)
        if(nextElem.includes('<a')) {
            var linkHref = $(this).find('a').attr('href');

            // Redirect to the href of the link
            window.location.href = linkHref;
        }
    });
    //adjustSidebarAppearance(true);
    //iconAnimation();
    $('#sidebarMenu').hide();
    $('main#dashboard').show();
}

function adjustSidebarAppearance2(){

    if ($('#sidebarMenu').is(':visible')) {
        enableTrackScroll()
        $('#sidebarMenu').find('.collapse').removeClass('show').end()
        $('#sidebarMenu').animate({ 'max-height': '0' }, 500, function() {
            $('#sidebarMenu').find('.list-group-item').addClass('text-center');
            $('#sidebarMenu').fadeOut()
        });
    } else {
        disableTrackScroll()
        $('#sidebarMenu').fadeIn()
        $('#sidebarMenu').find('.list-group-item').removeClass('text-center').end()
        $('#sidebarMenu').find('.hide-text').show();
        $('#sidebarMenu').animate({ 'max-height': '100vh' }, 500, function() {
        });
    }
}
function handleSideBar2(){
    $('#sidebarMenu').hide()
    $('#sidebarMenu').css({ 'max-height': '0' ,width:"100%"})
    $('main#dashboard').show();
    $('#sidebarMenuToggleSmall').on('click', adjustSidebarAppearance2);
}
function handleMemo(){
$('button#memo').on('click', function() {
    let memo = $('[name="memo"]').val();
    if(memo.length == 0){
        alert('保存する前にメモを書いてください。')
        return
    }
    // Make the AJAX request
    $.ajax({
        url: '/api/user/memo',
        type: 'POST',
        data: {
            content: memo
        },
        success: function(response) {
            console.log('Memo saved successfully');
            location.reload()
            // Additional code to handle the response
        },
        error: function(error) {
            console.log('Error saving memo:', error);
            // Additional code to handle the error
        }
    });
});
// Listen for click events on buttons with the class .remove-memo
$('.remove-memo').on('click', function(e) {
    e.preventDefault()
    const confirmation = confirm("削除してもよろしいでしょうか？");

    if (!confirmation) {
        return
    }
    // Extract the memo ID from the data-id attribute of the clicked button
    const $cardContainer = $(this).closest('.card')
    let memoId = $cardContainer.data('id');

    // Make the AJAX DELETE request
    $.ajax({
        url: '/api/user/memo/' + memoId, // Construct the URL with the memo ID
        type: 'DELETE',
        success: function(response) {
            console.log('Memo removed successfully');
            $cardContainer .remove()
            // Additional code to handle the response, e.g., remove the memo from the UI
        },
        error: function(error) {
            console.log('Error removing memo:', error);
            // Additional code to handle the error
        }
    });
});

}

function handleStream(response,callback,endCallback) {
    console.log(`Start streaming on : ${response.redirect}`);

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

        handleCopyButtons();

        console.log("Stream has ended:", {data});

        source.close();

    });

    source.onerror = function(error) {
        console.error("EventSource failed:", error);
        if (endCallback) endCallback(data);
        source.close();
    };

    return source;
}

function stopStreams(sources) {
    if (sources instanceof EventSource) {
        // It's a single stream.
        sources.close();
        console.log("Single stream has been stopped.");
    } else if (typeof sources === 'object' && sources !== null) {
        // It's an object containing multiple streams.
        for (let key in sources) {
            if (sources[key] instanceof EventSource) {
                sources[key].close();
                console.log(`Stream ${key} has been stopped.`);
            }
        }
    } else {
        console.error("Invalid input provided to stopStreams.");
    }
}



function formDataArray(type) {
    const resultArray = [];
    // Gather all the keywords from the input fields
    $(`[name="${type}[]"]`).each(function() {
        const data = $(this).val().trim();
        if (data) {
            resultArray.push(data);
        }
    });
    return resultArray
}
function handleCheckboxState() {
    var isChecked = $('#aiCheckbox').prop('checked');
    
    $('.chapters-inputs input').prop('disabled', isChecked);

    if (isChecked) {
        $('.add-chapters').hide();
    } else {
        $('.add-chapters').show();
    }
}

function handleCounterAndAddForm(){
    // Create an empty object to store the counters for each item type
let counters = {};

// Use a more generalized class for the event listener
$('.add-item').click(function() {
    // Get the type and label from data attributes
    const type = $(this).data('name');
    const label = $(this).data('label');

    // Check if counter for this type exists, if not initialize it
    if(!counters[type]) counters[type] = 1;

    if(counters[type] >= 5) {
        alert(`${label}の最大数に達しました。`);
        return;
    }

    let itemVal = $(`#${type}-${counters[type]}`).val();

    if(itemVal.length == 0){
        alert(`${label}を書いてください。`);
        return;
    }

    counters[type]++; // increment the counter

    const newInput = $(`
        <div class="col p-1">
            <input type="text" class="form-control" name="${type}[]" id="${type}-${counters[type]}" placeholder='20代' >
        </div>
    `);

    // Use a more generalized class for the container
    $(`.${type}-inputs`).append(newInput);
});

}

function onLargeScreen(callback){

    if (typeof callback !== 'function') {
        console.error("Provided argument is not a function.");
        return;
    }

    window.addEventListener('resize', function() {
        if (window.innerWidth >= YOUR_LARGE_SCREEN_BREAKPOINT) {
            //callback();
        }
    });
    
    // Initial check
    if (window.innerWidth >= YOUR_LARGE_SCREEN_BREAKPOINT) {
        callback();
    }
    
}
function onSmallScreen(callback){

    if (typeof callback !== 'function') {
        console.error("Provided argument is not a function.");
        return;
    }
    
    window.addEventListener('resize', function() {
        if (window.innerWidth < YOUR_LARGE_SCREEN_BREAKPOINT) {
            //callback();
        }
    });
    
    // Initial check
    if (window.innerWidth < YOUR_LARGE_SCREEN_BREAKPOINT) {
        callback();
    }
    
}
let lastScrollTop = 0;

function enableTrackScroll() {
    const threshold = 50;

    $(window).on("scroll.trackScroll", function() {
        let currentScrollTop = $(this).scrollTop();
        let scrollDifference = Math.abs(currentScrollTop - lastScrollTop);
        let atTopOfPage = currentScrollTop === 0;
        let atBottomOfPage = currentScrollTop + $(window).height() >= $(document).height();

        if (atTopOfPage || atBottomOfPage || scrollDifference >= threshold) {
            if (currentScrollTop > lastScrollTop && !atTopOfPage && !atBottomOfPage) { // Scrolling down
                $(".auto-hide").fadeOut();
            } else { // Scrolling up or at top/bottom of page
                $(".auto-hide").fadeIn();
            }
            lastScrollTop = currentScrollTop;
        }
    });
}

function disableTrackScroll() {
    $(window).off("scroll.trackScroll");
}


function iconAnimation(){
    var icon = $("#sidebarMenuToggle i");

    if(!icon.hasClass('init')){
        icon.addClass('init')
        return
    }
    // Toggle the class
    icon.toggleClass("rotate-180");

    // Check if the class is not present
    if (!icon.hasClass("rotate-180")) {
    icon.css("animation", "rotate0 1s forwards");

    } else {
    icon.css("animation", "rotate180 1s forwards");

    }
      
}
function showSpinner($buttonContainer,type) {
    $buttonContainer.find('i').hide();

    if (!$buttonContainer.find('.spinner-border.for-'+type).length) {
        var $spinner = $('<div>').addClass(`spinner-border for-${type} spinner-border-sm mx-2`).attr('role', 'status');
        var $span = $('<span>').addClass('visually-hidden').text('読み込み中...');
        $spinner.append($span);
        $buttonContainer.prepend($spinner);
    }

    // Show the spinner while the download is in progress
    var $spinner = $buttonContainer.find('.spinner-border');
    $spinner.show();

    return $spinner
}
function watchAndConvertMarkdown(sourceSelector, outputSelector) {
    // Use showdown library to convert markdown to HTML
    const converter = new showdown.Converter();
    
    function convertMarkdownToHTML(markdownContent) {
        return converter.makeHtml(markdownContent);
    }

    // Initialize MutationObserver to watch for changes in the source selector
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === "childList") {
                let markdownContent = $(sourceSelector).text();
                let htmlContent = convertMarkdownToHTML(markdownContent);
                $(outputSelector).html(htmlContent);
            }
        });
    });

    // Configuration of the observer
    const config = {
        attributes: true,
        childList: true,
        characterData: true,
        subtree: true
    };

    // Start observing the target node for configured mutations
    observer.observe(document.querySelector(sourceSelector), config);
}
function generateStream(type,gpt3Prompt,data,callback,errorcallback){
    // simulate request
    $.ajax({
        url: '/api/openai/custom/'+type, // replace with your endpoint
        method: 'POST',
        data: { prompt: gpt3Prompt, time: new Date(), data },
        success: function(response) {
            callback(response)
        },
        error: function(error) {
            console.error(error);
            errorcallback()
        }
    }); 
}
       

function updateMoments(){
    $('.custom-date').each(function(){
        const dateValue = $(this).data('value');
        const date = new Date(dateValue);
        const now = new Date();
        const diffInSeconds = (now - date) / 1000;
        let displayText;

        if (diffInSeconds < 60) {
            displayText = Math.round(diffInSeconds) + ' 秒前';
        } else if (diffInSeconds < 3600) {
            displayText = Math.round(diffInSeconds / 60) + ' 分前';
        } else if (diffInSeconds < 86400) {
            displayText = Math.round(diffInSeconds / 3600) + ' 時間前';
        } else {
            displayText = Math.round(diffInSeconds / 86400) + ' 日前';
        }
        
    
        $(this).text(displayText);
    });
    
}
      
function handleCopyButtons() {
    $(document).on('click', '.tool-button-copy', function() {
      let content = $(this).closest('.card').find(".card-body p").text().trim();
      let tempTextArea = $("<textarea></textarea>");
      $("body").append(tempTextArea);
      tempTextArea.val(content);
      tempTextArea.select();
      document.execCommand("copy");
      tempTextArea.remove();
  
      // Update the tooltip title to "コピーしました" and show it
      $(this).attr('title', 'コピーしました').tooltip('_fixTitle').tooltip('show');
  
      // After 2 seconds, revert the tooltip title to "コピー"
      setTimeout(() => {
        $(this).attr('title', 'コピー').tooltip('_fixTitle');
      }, 2000);
    });
}

function handleShareButton(e) {
    const tweetText = $(e).closest('.card').find(`.card-body p`).text();
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url`)
}
function handleAccordions(){
        $('.accordion-item').on('show.bs.collapse', function () {
          // Get the id of the accordion that is about to be shown
          const currentAccordionId = $(this).find('.accordion-collapse').attr('id');
      
          // Loop through all accordion items
          $('.accordion-item').each(function () {
            // Get the id of the current accordion item in the loop
            const accordionId = $(this).find('.accordion-collapse').attr('id');
      
            // If the current accordion item in the loop is not the one that's about to be shown, hide it
            if (accordionId !== currentAccordionId) {
              $('#' + accordionId).collapse('hide');
            }
          });
        });
      
}
function cancelSubscription(subscriptionID){

    const confirmation = confirm("メンバーシップを削除してもよろしいですか？");

    if (confirmation) {
        $.ajax({
            url: `/payment/subscription/cancel/`+subscriptionID,
            type: 'POST',
            success: handleFormSuccess,
            error: handleFormError
        });
    }
    
}
const handleUserProfile = () => {
    let formChanged = false;
    let form = $('#updateProfile form').not('#reset-form');
    let inputs = $('#updateProfile form input, #updateProfile form select, #updateProfile form textarea');
    let initialFormData = new FormData(form[0]);

    inputs.change(() => formChanged = true);
    form.on('submit', () => formChanged = false);
    window.onbeforeunload = () => formChanged ? "You have unsaved changes. Are you sure you want to leave this page?" : undefined;
    // Form submission handling
    form.on('submit', function(e) {
        e.preventDefault();

        let formData = new FormData(this);

        console.log(formData);

        if (!checkFormChange(initialFormData, formData)) {
            alert('フォームに変更はありません。');
            return
        }

        handleFormSubmission(formData);
    }); 

    // Image preview and click to trigger file input
    const profileImageInput = document.getElementById('profileImage');
    const bannerImageInput = document.getElementById('bannerImage');
    const galleryImageInput = document.getElementById('image-upload');

    if (profileImageInput && bannerImageInput && galleryImageInput) {
      inputTrigger(profileImageInput, document.querySelector('.profile-image'));
      inputTrigger(bannerImageInput, document.querySelector('.banner-image'));
      inputTrigger(galleryImageInput, document.querySelector('#upload-btn'));
  
      previewImage(profileImageInput, document.querySelector('.profile-image img'));
      previewImage(bannerImageInput, document.querySelector('.header img'));
      previewImage(galleryImageInput, document.querySelector('img#image-upload-holder'));
  
    }
    // Active Tab
    if($('#updateProfile').length>0){
        if (document.querySelector('.nav-tabs')) {
            let activeTab = localStorage.getItem('activeTab');
            if(activeTab){
              new bootstrap.Tab(document.querySelector(`a[href="${activeTab}"]`)).show();
            }else{
              new bootstrap.Tab(document.querySelector(`a[href="#personalInfo"]`)).show();
            }
            $('#updateProfile').fadeIn()
            document.querySelectorAll('.nav-tabs a').forEach(t => t.addEventListener('shown.bs.tab', (e) => {
                localStorage.setItem('activeTab', e.target.getAttribute('href'));
            }));
          }
    }
}
const handleEvents = () => {
    // Other event listeners
    $(document).on('click', '.alert-container', function() { $(this).fadeOut();  });
    $(".card.pricing").hover(() => $(this).addClass('border-primary'), () => $(this).removeClass('border-primary'));
   
    $('.delete-button').click(function(e) { 
        e.preventDefault()
         handleHiding($(this).closest('.card').data('id'))  
    });
    $('.delete-button-history').click(function(e) {  
        e.preventDefault()
        $(this).closest('a').remove()
        handleHidingHistory($(this).closest('.card').data('query'))  
    });
    
    $(".card").on('mouseenter', function(){
        $(this).find('.hover').show();
    });

    $(".card").on('mouseleave', function(){
        $(this).find('.hover').hide();
    });

    $('input#searchTerm').on('change',function(){$('#page').val(1)})
      
      
    $(document).on('mouseenter', '.tool-button', function() {
        $(this).tooltip('show');
    });
    $(document).on('mouseout', '.tool-button', function() {
        $(this).tooltip('hide');
    });

      
    // Initialize the showdown converter
    const converter = new showdown.Converter();

    // Grab the text from the .convertToHTML element(s)
    $('.convertToHTML').each(function() {
        let markdownContent = $(this).text();
        let htmlContent = converter.makeHtml(markdownContent);

        // Replace the content of the element with the converted HTML
        $(this).html(htmlContent);
    });
}
