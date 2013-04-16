$(function(){

  function insertScript(url, nodeName) {
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = url;
    var parentNode = document.getElementsByTagName(nodeName || 'head')[0];
    parentNode.appendChild(script);
    console.log("casmacat inserts script:", url);
  };

  function insertStyle(url) {
    var css = document.createElement('link');
    css.type = 'text/css';
    css.rel = "stylesheet";
    css.href = url;
    var parentNode = document.getElementsByTagName('head')[0];
    parentNode.appendChild(css);
    console.log("casmacat inserts style:", url);
  };

  insertStyle(config.basepath  + 'public/css/itp.css');
  if (config.penEnabled) {
    insertStyle(config.basepath  + 'public/css/htr.css');
  }
  
  require('jquery.editable.itp');

  function getEditArea() {
    //return $(UI.currentSegment).find('.editarea');
    return UI.editarea || $('.editarea', UI.currentSegment);
  };

  function formatItpMatches(data) {
    var matches = [];
    for (var d, i = 0; i < data.nbest.length; ++i) {
      d = data.nbest[i];
      matches.push({
                 segment: data.source,
             translation: d.target,
              created_by: d.author,
                   match: parseInt(d.quality * 100),
        last_update_date: new Date()
      });
    }
    return { matches: matches };
  };

  function toogleEpenMode(editarea) {
    if (!config.penEnabled) {
      return false;
    }
    
    var $target = $(editarea), sid = $target.data('sid'), prefix = "#segment-" + sid;
    var $source = $(prefix + "-source"), $section = $(prefix), animMs = 300;
    var $targetParent = $(prefix + "-target");
    $section.find('.wrap').toggleClass("epen-wrap");
    $source.toggleClass("epen-source", animMs);
    $target.toggleClass("epen-target", animMs, function(){
      var $canvas = $targetParent.find('canvas'), $clearBtn = $('.buttons', UI.currentSegment).find('.pen-clear-indicator');    
      // Create canvas on top
      if ($canvas.length === 0) {
        var geom = require('geometry-utils'),
             pos = $target.offset(), 
             siz = { width: $target.width() + 25, height: $target.height() + 35 };
        
        $canvas = $('<canvas tabindex="-1" id="'+prefix+'-canvas" width="'+(siz.width)+'" height="'+(siz.height)+'"/>');
        $canvas.prependTo($targetParent).hide().delay(10).css({
             top: $source.height() + 15,
            left: 7,
          zIndex: geom.getNextHighestDepth()
        }).bind('mousedown mouseup click', function(e){
          // This is to prevent logging click events on the canvas
          e.stopPropagation();
        });

        var htr = require('htr');
        htr.init($canvas, $source, $target);
        
        // A button to clear canvas (see http://ikwebdesigner.com/special-characters/)
        if ($clearBtn.length === 0) {
          $clearBtn = $('<li/>').html('<a href="#" class="draft pen-clear-indicator" title="Clear drawing area">&#10227;</a>');
          $clearBtn.click(function(e){
            e.preventDefault();
            $canvas.sketchable('clear');
          });
          $('.buttons', UI.currentSegment).prepend($clearBtn);
          $clearBtn.hide();
        }
      } else {
        $canvas = $targetParent.find('canvas');
      }
      /*
      // TODO: Remove suffix length feature for e-pen mode and restore previous prioritizer
      $target.editableItp('updateConfig', {
        prioritizer: "none"
      });
      */
      // Toogle buttons
      $canvas.sketchable('clear').toggle();
      $clearBtn.toggle();
      // Toggle translation matches et al.
      $section.find('.overflow').toggle(animMs);    
      // Remove contenteditable selection
      var sel = window.getSelection();
      sel.removeAllRanges();
    });
  };
  
  // Overwrite UI methods ------------------------------------------------------

  UI.callbacks = {};

  UI.setKeyboardShortcuts = function(){}; // FTW
  UI.reinitMMShortcuts    = function(){}; // Use shortcuts.js instead
  require('shortcuts');
  
  var original_openSegment = UI.openSegment;
  var original_closeSegment = UI.closeSegment;
  var original_doRequest = UI.doRequest;
  var original_copySuggestionInEditarea = UI.copySuggestionInEditarea;
        
  UI.openSegment = function(editarea) {
    original_openSegment.call(UI, editarea);
    var $target = $(editarea), sid = $target.data('sid'), $source = $("#segment-" + sid + "-source");
                  
    $target.on('ready.matecat', function() {
      var settings, $indicator;
      if (config.catsetting) {
        settings = require(config.basepath + '/' + config.catsetting);
      } else {
        settings = $target.editableItp('getConfig');
      }
      if ($target.text().length === 0 && settings.mode != "manual") {
        $target.editableItp('decode');
      }
      $target.editableItp('startSession');
      $target.editableItp('updateConfig', settings);
      // A button to toggle ITP mode
      $indicator = ('.buttons', UI.currentSegment).find('.itp-indicator');
      if (config.itpserver && settings.mode == "ITP" && $indicator.length === 0) {
        $indicator = $('<li/>').html('<a href="#" class="draft itp-indicator">'+settings.mode+'</a><p>ESC</p>');
        $indicator.click(function(e){
          e.preventDefault();
          UI.toggleItp(e);
        });
        $('.buttons', UI.currentSegment).prepend($indicator);
      }
      // A button to toggle e-pen mode
      $indicator = $('.buttons', UI.currentSegment).find('.pen-indicator');
      if (config.htrserver && config.penEnabled && $indicator.length === 0) {
        $indicator = $('<li/>').html('<a href="#" class="draft pen-indicator" title="Toggle e-pen input">&#9997;</a>');
        $indicator.click(function(e){
          e.preventDefault();
          toogleEpenMode(editarea);
        });
        $('.buttons', UI.currentSegment).prepend($indicator);
      }
    })
    .editableItp({
      sourceSelector: "#segment-" + sid + "-source",
      itpServerUrl:   config.itpserver,
      replay:         config.replay
    })
    .on('decode.matecat', function (ev, data, err) {
        $(window).trigger('translationChange', {element: $target[0], type: "decode", data: data});
    })
    .on('suffixchange.matecat', function (ev, data, err) {
        $(window).trigger('translationChange', {element: $target[0], type: "suffixchange", data: data});
    })
    .on('confidences.matecat', function (ev, data, err) {
        $(window).trigger('translationChange', {element: $target[0], type: "confidences", data: data});
    })
    .on('tokens.matecat', function (ev, data, err) {
        $(window).trigger('translationChange', {element: $target[0], type: "tokens", data: data});
    })
    .on('alignments.matecat', function (ev, data, err) {
        $(window).trigger('translationChange', {element: $target[0], type: "alignments", data: data});

        $target.find('span.editable-token')
        .off('mouseenter.matecat mouseleave.matecat caretenter.matecat caretleave.matecat')
        .on('mouseenter.matecat', function (ev) {
          $(window).trigger('showAlignmentByMouse', ev.target, ev.clientX, ev.clientY);
        })
        .on('mouseleave.matecat', function (ev) {
          $(window).trigger('hideAlignmentByMouse', ev.target);
        })
        .on('caretenter.matecat', function (ev, data) {
          // change dom node in data by its id to avoid circular problem when converting to JSON
          var d = jQuery.extend({}, data); d.token = '#'+d.token.id;
          $(window).trigger('showAlignmentByKey', {element: $target[0], type: "caretenter", data: d});
        })
        .on('caretleave.matecat', function (ev, data) {
          // change dom node in data by its id to avoid circular problem when converting to JSON
          var d = jQuery.extend({}, data); d.token = '#'+d.token.id;
          $(window).trigger('hideAlignmentByKey', {element: $target[0], type: "caretleave", data: d});
        })

        $source.find('span.editable-token').off('mouseenter.matecat mouseleave.matecat')
        .on('mouseenter.matecat', function (ev) {
          $(window).trigger('showAlignmentByMouse', ev.target);
        })
        .on('mouseleave.matecat', function (ev) {
          $(window).trigger('hideAlignmentByMouse', ev.target);
        })
    });
    
    addSearchReplaceEvents();
  };

  UI.closeSegment = function(editarea) {
    // WTF? editarea semantics is not the same as in openSegment
    if (editarea) {
      var sid = $(editarea).attr('id');
      var $target = $('#'+sid+'-editarea'), $source = $('#'+sid+'-editarea');
      $target.find('*').andSelf().off('.matecat');
      $source.find('*').andSelf().off('.matecat');
      $target.editableItp('destroy');
      if ($target.hasClass('epen-target')) {
        toogleEpenMode($target);
      }
    }
    original_closeSegment.call(UI, editarea);
  };

  /*UI.copySuggestionInEditarea = function(editarea) {
    $('.editarea').editable({ ... });
    original_copySuggestionInEditarea.call(UI, editarea);
  };*/

  UI.doRequest = function(req) {
    var d = req.data, a = d.action, $ea = getEditArea();
    UI.saveCallback(a, req);
    // Call action
    switch(a) {
      case "getContribution":
        $ea.unbind('decode').bind('decode', function(e, data, err){
          UI.executeCallback(a, {
            data: formatItpMatches(data)
          });
        });
        // Edge case: Loading a DRAFTed segment should fire the complete UI callback
        if (typeof d.num_results === 'undefined') {
          req.complete(d);
        }
        break;
      case "setContribution":
        $ea.unbind('validate').bind('validate', function(e, data, err){
          UI.executeCallback(a, {
            data: formatItpMatches(data)
          });
        });

        break;
      default:
        console.log("Forwarding request 'as is':", a);
        original_doRequest.call(UI, req);
        break;
    }
  };

  UI.saveCallback = function(action, req) {
    if ((req.success  && typeof req.success  === 'function') ||
        (req.complete && typeof req.complete === 'function')) {
      // Merge callbacks, as we don't have an Ajax transport in ITP
      if (!UI.callbacks.hasOwnProperty(action)) UI.callbacks[action] = [];
      UI.callbacks[action].push(req);
    }
  };

  UI.executeCallback = function(action, data) {
    var req = UI.callbacks[action].shift();
    if (typeof req === 'undefined') return;
    if (req.hasOwnProperty('success') && typeof req.success === 'function') {
      console.log("executing success callback:", action, data);
      req.success(data);
    }
    if (req.hasOwnProperty('complete') && typeof req.complete === 'function') {
      console.log("executing complete callback:", action, data);
      req.complete(data);
    }
    //return req.data;
  };

  // BEGIN S&R facilities ------------------------------------------------------  
  if (config.catsetting) {
    var settings = require(config.basepath + '/' + config.catsetting);
    if (settings) {
      // For the evaluation, S&R can be optional
      if (settings.allowSearchReplace || !settings.hasOwnProperty('allowSearchReplace')) {
        setupSearchReplace();
      } else {
        $('#sr-replace').hide();
      }
    }
  }

  $('#sr-rules').hide(); // In any case, this must be hidden beforehand
  
  function addSearchReplaceEvents() {
    var $ea = getEditArea(), itpServer = $ea.editableItp('itpServer');
    
    itpServer.on('setReplacementRuleResult', function(data, err) {
      itpServer.getReplacementRules();
    });

    itpServer.on('delReplacementRuleResult', function(data, err) {
      itpServer.getReplacementRules();
    });
   
    itpServer.on('applyReplacementRulesResult', function(data, err) {
    });

    itpServer.on('getReplacementRulesResult', function(data, err) {
      $('#sr-rules').empty();
      for (var i = 0; i < data.rules.length; ++i) { 
        processRule(data.rules[i]);
      }
    });
  };
  
  function delSearchReplaceEvents() {
    var $ea = getEditArea(), itpServer = $ea.editableItp('itpServer');
    itpServer.off('setReplacementRuleResult delReplacementRuleResult getReplacementRulesResult');
  };  
  
  function processRule(rule) {
    var $ea = getEditArea(), itpServer = $ea.editableItp('itpServer');
    // Apply rule for the first time
    var sid = $ea.data('sid'), $source = $("#segment-" + sid + "-source");
    itpServer.applyReplacementRules({
      source: $source.text(),
      target: $ea.editable('getText'),
    });
    // Then inform the user about the rule
    var $btn = $('<a class="sr-delrule" href="#">[remove]</a>');
    $btn.click(function(e){
      e.preventDefault();
      var $ea = getEditArea(), itpServer = $ea.editableItp('itpServer');
      itpServer.delReplacementRule({ruleId: rule.ruleId});
      //if ($('#sr-rules ol li').length === 0) $('#sr-rules').hide();
    });
    var $li = $('<li/>');
    if (rule.fails > 0) $li.css('color', 'red');
    $li.data('rule', JSON.stringify(rule));
    var ruleText  = "source: " + rule.sourceRule;
        ruleText += " | target: " + rule.targetRule;
        ruleText += " | replacement: " + rule.targetReplacement;
    if (rule.isRegExp)  ruleText += " | regexp";
    if (rule.matchCase) ruleText += " | case sensitive";
        ruleText += " ";
    $li.text(ruleText).append($btn);
    $('#sr-rules').append($li);
  };

  function setupSearchReplace() {
    $('#sr-viewreplaceBtn').click(function(e){
      $('#sr-rules').toggle("fast");
    });
    
    $('#sr-addreplaceBtn').click(function(e){
      var rule = {};
      $("#sr-replace :input").each(function(){
        var $this = $(this); 
        if (!$this.attr('name')) return;
        if ($this.attr('type') === 'checkbox') {
          rule[$this.attr('name')] = $this.prop('checked');  
        }
        else {
          rule[$this.attr('name')] = $this.val();  
        }
      });
      var $ea = getEditArea(), itpServer = $ea.editableItp('itpServer');
      itpServer.setReplacementRule(rule);
    });
  };
  // END S&R facilities --------------------------------------------------------
     
});
