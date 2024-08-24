let stripe
if(window.location.href.indexOf('https://') >= 0){
  stripe = Stripe('pk_live_51PjtRbE5sP7DA1XvCkdmezori9qPGoO21y7yKSVvgkQVyrhWZfHAUkNsjPMnbwpPlp4zzoYsRjn79Ad7XN7HTHcc00UjBA9adF'); // Use your publishable key here
}else{
  stripe = Stripe('pk_test_51PjtRbE5sP7DA1XvD68v7X7Qj7pG6ZJpQmvuNodJjxc7MbH1ss2Te2gahFAS9nms4pbmEdMYdfCPxFDWHBbu9CxR003ikTnRES'); // Use your publishable key here
}

function createCheckoutSession(e) {
  const cycle = $(e).data('cycle');
  const priceId = cycle === 'yearly' ? $(e).data('price-yearly') : $(e).data('price-monthly');
  
  fetch('/payment/create-checkout-session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      price_id: priceId
    })
  })
  .then(function (response) {
    return response.json();
  })
  .then(function (session) {
    return stripe.redirectToCheckout({ sessionId: session.id });
  })
  .catch(function (error) {
    console.error('Error:', error);
  });
}
function updatePaymentMethod(e) {
  const userId = $(e).data('user-id'); // Assuming the user ID is stored in data attributes

  fetch('/payment/create-checkout-session-for-update', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      userId: userId,
    })
  })
  .then(function (response) {
    return response.json();
  })
  .then(function (session) {
    return stripe.redirectToCheckout({ sessionId: session.id });
  })
  .catch(function (error) {
    console.error('Error:', error);
  });
}

$(document).ready(function() {
  function checkUserSubscription() {
      $.ajax({
          type: "GET",
          url: "/payment/check-subscription",
          dataType: "json",
          success: function(response) {
              if (response.success) {
                  console.log("Success:", response.message);
                  // Handle success case, e.g., display a message or update UI
              } else {
                  console.log("Error:", response.message);
                  // Handle error case, e.g., display an error message or update UI
              }
          },
          error: function(jqXHR, textStatus, errorThrown) {
              console.error("Request failed:", textStatus, errorThrown);
              // Handle the failure case, e.g., display an error message or update UI
          }
      });
  }

  // You can now call the function wherever needed in your code
  // For instance, you might want to check the subscription when the page loads:
   checkUserSubscription();
});
