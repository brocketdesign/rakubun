// Rakubun AI Landing Page JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Initialize all features
    initSmoothScrolling();
    initScrollAnimations();
    initDemoSteps();
    initFloatingElements();
    initHeaderScroll();
    initParallaxEffects();
    initCounterAnimations();
    initTypingAnimation();
    initPricingCardEffects();
    initTestimonialSlider();
});

// Smooth scrolling for navigation links
function initSmoothScrolling() {
    const links = document.querySelectorAll('a[href^="#"]');
    
    links.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            
            if (targetSection) {
                const headerHeight = document.querySelector('.header').offsetHeight;
                const targetPosition = targetSection.offsetTop - headerHeight;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// Scroll-triggered animations
function initScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
                
                // Stagger animations for grid items
                if (entry.target.classList.contains('grid-container')) {
                    const items = entry.target.querySelectorAll('.grid-item');
                    items.forEach((item, index) => {
                        setTimeout(() => {
                            item.classList.add('animate-in');
                        }, index * 100);
                    });
                }
            }
        });
    }, observerOptions);
    
    // Observe sections
    const sections = document.querySelectorAll('section');
    sections.forEach(section => observer.observe(section));
    
    // Observe cards
    const cards = document.querySelectorAll('.problem-card, .benefit-card, .feature-card, .testimonial-card, .pricing-card');
    cards.forEach(card => observer.observe(card));
}

// Demo steps functionality
function initDemoSteps() {
    const steps = document.querySelectorAll('.step');
    const stepContents = document.querySelectorAll('.demo-step-content');
    let currentStep = 1;
    let autoPlayInterval;
    
    function showStep(stepNumber) {
        // Remove active class from all steps
        steps.forEach(step => step.classList.remove('active'));
        stepContents.forEach(content => content.style.display = 'none');
        
        // Add active class to current step
        const activeStep = document.querySelector(`[data-step="${stepNumber}"]`);
        const activeContent = document.getElementById(`step-${stepNumber}`);
        
        if (activeStep && activeContent) {
            activeStep.classList.add('active');
            activeContent.style.display = 'flex';
        }
    }
    
    function nextStep() {
        currentStep++;
        if (currentStep > 3) currentStep = 1;
        showStep(currentStep);
    }
    
    function startAutoPlay() {
        autoPlayInterval = setInterval(nextStep, 4000);
    }
    
    function stopAutoPlay() {
        clearInterval(autoPlayInterval);
    }
    
    // Manual step control
    steps.forEach(step => {
        step.addEventListener('click', function() {
            const stepNumber = parseInt(this.getAttribute('data-step'));
            currentStep = stepNumber;
            showStep(stepNumber);
            stopAutoPlay();
            setTimeout(startAutoPlay, 8000); // Restart auto-play after 8 seconds
        });
        
        step.addEventListener('mouseenter', stopAutoPlay);
        step.addEventListener('mouseleave', startAutoPlay);
    });
    
    // Start auto-play
    startAutoPlay();
}

// Floating elements animation
function initFloatingElements() {
    const floatingElements = document.querySelectorAll('.floating-icon');
    
    floatingElements.forEach((element, index) => {
        // Random initial position
        element.style.left = Math.random() * 80 + 10 + '%';
        element.style.top = Math.random() * 80 + 10 + '%';
        
        // Animate element
        setInterval(() => {
            const newX = Math.random() * 80 + 10;
            const newY = Math.random() * 80 + 10;
            
            element.style.transform = `translate(${newX - 50}%, ${newY - 50}%) rotate(${Math.random() * 360}deg)`;
        }, 8000 + (index * 2000));
    });
}

// Header scroll effect
function initHeaderScroll() {
    const header = document.querySelector('.header');
    let lastScrollY = window.scrollY;
    
    window.addEventListener('scroll', () => {
        const currentScrollY = window.scrollY;
        
        if (currentScrollY > 100) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
        
        // Hide header when scrolling down, show when scrolling up
        if (currentScrollY > lastScrollY && currentScrollY > 200) {
            header.style.transform = 'translateY(-100%)';
        } else {
            header.style.transform = 'translateY(0)';
        }
        
        lastScrollY = currentScrollY;
    });
}

// Parallax effects
function initParallaxEffects() {
    const parallaxElements = document.querySelectorAll('.floating-elements, .hero::before');
    
    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        const rate = scrolled * -0.5;
        
        parallaxElements.forEach(element => {
            element.style.transform = `translateY(${rate}px)`;
        });
    });
}

// Counter animations
function initCounterAnimations() {
    const stats = document.querySelectorAll('.stat-number');
    
    const animateCounter = (element, target) => {
        let current = 0;
        const increment = target / 30;
        const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
                element.textContent = target === Infinity ? '∞' : target;
                clearInterval(timer);
            } else {
                element.textContent = Math.floor(current);
            }
        }, 50);
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const target = entry.target.textContent;
                if (target === '∞') {
                    // Special handling for infinity symbol
                    entry.target.style.animation = 'pulse 2s infinite';
                } else {
                    animateCounter(entry.target, parseInt(target));
                }
                observer.unobserve(entry.target);
            }
        });
    });
    
    stats.forEach(stat => observer.observe(stat));
}

// Typing animation for demo
function initTypingAnimation() {
    const typingElement = document.querySelector('.prompt-input input');
    if (!typingElement) return;
    
    const texts = [
        'ChatGPTの活用方法について',
        'WordPress初心者向けガイド',
        'リモートワークの効率化',
        'SEO対策の基本知識',
        'ブログ収益化のコツ'
    ];
    
    let textIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    
    function typeText() {
        const currentText = texts[textIndex];
        
        if (isDeleting) {
            typingElement.value = currentText.substring(0, charIndex - 1);
            charIndex--;
        } else {
            typingElement.value = currentText.substring(0, charIndex + 1);
            charIndex++;
        }
        
        let delay = isDeleting ? 50 : 100;
        
        if (!isDeleting && charIndex === currentText.length) {
            delay = 2000; // Pause at end
            isDeleting = true;
        } else if (isDeleting && charIndex === 0) {
            isDeleting = false;
            textIndex = (textIndex + 1) % texts.length;
            delay = 500;
        }
        
        setTimeout(typeText, delay);
    }
    
    // Start typing animation after a delay
    setTimeout(typeText, 2000);
}

// Pricing card effects
function initPricingCardEffects() {
    const pricingCards = document.querySelectorAll('.pricing-card');
    
    pricingCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            // Add glow effect
            this.style.boxShadow = '0 25px 50px rgba(102, 126, 234, 0.3)';
            
            // Animate price
            const price = this.querySelector('.amount');
            if (price && !this.classList.contains('popular')) {
                price.style.animation = 'pulse 0.5s ease-in-out';
            }
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.boxShadow = '';
            const price = this.querySelector('.amount');
            if (price) {
                price.style.animation = '';
            }
        });
    });
}

// Testimonial slider (if more testimonials are added)
function initTestimonialSlider() {
    const testimonials = document.querySelectorAll('.testimonial-card');
    
    testimonials.forEach((testimonial, index) => {
        // Add entrance animation delay
        testimonial.style.animationDelay = `${index * 0.2}s`;
        
        // Add hover effect
        testimonial.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-10px) scale(1.02)';
        });
        
        testimonial.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });
}

// Add utility function for detecting mobile
function isMobile() {
    return window.innerWidth <= 768;
}

// Add touch support for mobile devices
function initTouchSupport() {
    if (isMobile()) {
        // Add touch-friendly hover effects
        document.addEventListener('touchstart', function(e) {
            const card = e.target.closest('.benefit-card, .feature-card, .pricing-card');
            if (card) {
                card.classList.add('touch-active');
                setTimeout(() => card.classList.remove('touch-active'), 300);
            }
        });
    }
}

// Initialize touch support
initTouchSupport();

// Add CSS for additional animations
const additionalStyles = `
    <style>
        .animate-in {
            animation: fadeInUp 0.6s ease-out forwards;
        }
        
        .header.scrolled {
            background: rgba(255, 255, 255, 0.98);
            box-shadow: 0 2px 20px rgba(0, 0, 0, 0.1);
        }
        
        .touch-active {
            transform: translateY(-5px) !important;
            transition: transform 0.3s ease !important;
        }
        
        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
        }
        
        @media (max-width: 768px) {
            .floating-elements {
                display: none;
            }
            
            .parallax-bg {
                transform: none !important;
            }
        }
        
        /* Loading states */
        .loading {
            position: relative;
            overflow: hidden;
        }
        
        .loading::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
            animation: loading 1.5s infinite;
        }
        
        @keyframes loading {
            0% { left: -100%; }
            100% { left: 100%; }
        }
        
        /* Smooth transitions for all interactive elements */
        .btn, .card, .pricing-card, .testimonial-card, .feature-card, .benefit-card {
            transition: all 0.3s ease;
        }
        
        /* Focus states for accessibility */
        .btn:focus, .step:focus {
            outline: 2px solid #667eea;
            outline-offset: 2px;
        }
        
        /* Reduced motion support */
        @media (prefers-reduced-motion: reduce) {
            *, *::before, *::after {
                animation-duration: 0.01ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: 0.01ms !important;
            }
        }
    </style>
`;

// Inject additional styles
document.head.insertAdjacentHTML('beforeend', additionalStyles);

// Add smooth loading effect
window.addEventListener('load', function() {
    document.body.classList.add('loaded');
    
    // Trigger initial animations
    const hero = document.querySelector('.hero');
    if (hero) {
        hero.classList.add('animate-in');
    }
});

// Performance optimization: Throttle scroll events
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    }
}

// Apply throttling to scroll-heavy functions
window.addEventListener('scroll', throttle(function() {
    // Throttled scroll functions can be added here
}, 16)); // ~60fps

// Add error handling for smoother experience
window.addEventListener('error', function(e) {
    console.warn('Landing page error:', e.message);
    // Gracefully handle errors without breaking the experience
});

// Add resize handler for responsive adjustments
window.addEventListener('resize', throttle(function() {
    // Recalculate positions if needed
    const floatingElements = document.querySelectorAll('.floating-icon');
    if (isMobile()) {
        floatingElements.forEach(el => el.style.display = 'none');
    } else {
        floatingElements.forEach(el => el.style.display = 'block');
    }
}, 250));