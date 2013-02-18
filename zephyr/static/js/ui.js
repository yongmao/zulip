var ui = (function () {

var exports = {};

// What, if anything, obscures the home tab?
exports.home_tab_obscured = function () {
    if ($('.modal:visible').length > 0)
        return 'modal';
    if (! $('#home').hasClass('active'))
        return 'other_tab';
    return false;
};

// We want to remember how far we were scrolled on each 'tab'.
// To do so, we need to save away the old position of the
// scrollbar when we switch to a new tab (and restore it
// when we switch back.)
var scroll_positions = {};
var gravatar_stamp = 1;

exports.change_tab_to = function (tabname) {
    $('#gear-menu a[href="' + tabname + '"]').tab('show');
};

exports.focus_on = function (field_id) {
    // Call after autocompleting on a field, to advance the focus to
    // the next input field.

    // Bootstrap's typeahead does not expose a callback for when an
    // autocomplete selection has been made, so we have to do this
    // manually.
    $("#" + field_id).focus();
};

$(document).bind('copy', function (e) {
    var selection = window.getSelection();
    var i, j, range, ranges = [], startc, endc, start_tr, end_tr, startid, endid, row, message;
    var skip_same_td_check = false;
    var div = $('<div>'), p  = $('<p>'), content;
    for (i = 0; i < selection.rangeCount; i++) {
        range = selection.getRangeAt(i);
        ranges.push(range);

        startc = $(range.startContainer);
        start_tr = $(startc.parents('tr')[0]);

        // If the selection starts somewhere that does not have a parent tr,
        // we should let the browser handle the copy-paste entirely on its own
        if (start_tr.length === 0) {
            return;
        }

        // If the selection starts on a table row that does not have an
        // associated message id (because the user clicked between messages),
        // then scan downwards until we hit a table row with a message id.
        // To ensure we can't enter an infinite loop, bail out (and let the
        // browser handle the copy-paste on its own) if we don't hit what we
        // are looking for within 10 rows.
        for (j = 0; (!start_tr.is('.message_row')) && j < 10; j++) {
            start_tr = start_tr.next();
        }
        if (j === 10) {
            return;
        } else if (j !== 0) {
            // If we updated start_tr, then we are not dealing with a selection
            // that is entirely within one td, and we can skip the same td check
            // (In fact, we need to because it won't work correctly in this case)
            skip_same_td_check = true;
        }
        startid = rows.id(start_tr);

        endc = $(range.endContainer);
        // If the selection ends in the bottom whitespace, we should act as
        // though the selection ends on the final message
        if (endc.attr('id') === "bottom_whitespace") {
            end_tr = $("tr.message_row:last");
            skip_same_td_check = true;
        } else {
            end_tr = $(endc.parents('tr')[0]);
        }

        // If the selection ends somewhere that does not have a parent tr,
        // we should let the browser handle the copy-paste entirely on its own
        if (end_tr.length === 0) {
            return;
        }

        // If the selection ends on a table row that does not have an
        // associated message id (because the user clicked between messages),
        // then scan upwards until we hit a table row with a message id.
        // To ensure we can't enter an infinite loop, bail out (and let the
        // browser handle the copy-paste on its own) if we don't hit what we
        // are looking for within 10 rows.
        for (j = 0; (!end_tr.is('.message_row')) && j < 10; j++) {
            end_tr = end_tr.prev();
        }
        if (j === 10) {
            return;
        } else if (j !== 0) {
            // If we updated start_tr, then we are not dealing with a selection
            // that is entirely within one td, and we can skip the same td check
            // (In fact, we need to because it won't work correctly in this case)
            skip_same_td_check = true;
        }
        endid = rows.id(end_tr);

        // If the selection starts and ends in the same td,
        // we should let the browser handle the copy-paste entirely on its own
        // (In this case, there is no need for our special copy code)
        if (!skip_same_td_check &&
            startc.parents('td')[0] === endc.parents('td')[0]) {
            return;
        }
        row = rows.get(startid);

        // Construct a div for what we want to copy (div)
        for (row = rows.get(startid); rows.id(row) <= endid; row = rows.next_visible(row)) {
            if (row.prev().hasClass("recipient_row")) {
                div.append(p);
                p = $('<p>');
                content = $('<div>').text(row.prev().children(".right_part").text()
                                            .replace(/\s+/g, " ")
                                            .replace(/^\s/, "").replace(/\s$/, ""));
                p.html(p.html() + "<b>" + content.text() + "</b>" + "<br>");
            }

            message = message_dict[rows.id(row)];

            content = $('<div>').text(message.sender_full_name + ": " +
                                $('<div/>').html(message.content).text()
                                .replace("\n", "<br>"));
            p.html(p.html() + content.text());
            p.html(p.html() + "<br>");
        }
    }
    div.append(p);

    // Select div so that the browser will copy it
    // instead of copying the original selection
    div.css({position: 'absolute', 'left': '-99999px'})
            .attr('id', 'copytempdiv');
    $('body').append(div);
    selection.selectAllChildren(div[0]);

    // After the copy has happened, delete the div and
    // change the selection back to the original selection
    window.setTimeout(function() {
        selection = window.getSelection();
        selection.removeAllRanges();
        $.each(ranges, function (index, range) {
            selection.addRange(range);
        });
        $('body').remove('#copytempdiv');
    },0);
});

/* We use 'visibility' rather than 'display' and jQuery's show() / hide(),
   because we want to reserve space for the email address.  This avoids
   things jumping around slightly when the email address is shown. */

var current_message_hover;
function message_unhover() {
    if (current_message_hover === undefined)
        return;
    current_message_hover.removeClass('message_hovered');
    current_message_hover = undefined;
}

function message_hover(message_row) {
    message_unhover();
    while (!message_row.hasClass('include-sender')) {
        message_row = message_row.prev();
    }
    message_row.addClass('message_hovered');
    current_message_hover = message_row;
}

exports.report_message = function (response, status_box, cls) {
    if (cls === undefined)
        cls = 'alert';

    status_box.removeClass(status_classes).addClass(cls)
              .text(response).stop(true).fadeTo(0, 1);
    status_box.show();
};

exports.report_error = function (response, xhr, status_box) {
    if (xhr.status.toString().charAt(0) === "4") {
        // Only display the error response for 4XX, where we've crafted
        // a nice response.
        response += ": " + $.parseJSON(xhr.responseText).msg;
    }

    ui.report_message(response, status_box, 'alert-error');
};

exports.report_success = function (response, status_box) {
    ui.report_message(response, status_box, 'alert-success');
};

var clicking = false;
var mouse_moved = false;

function mousedown() {
    mouse_moved = false;
    clicking = true;
}

function mousemove() {
    if (clicking) {
        mouse_moved = true;
    }
}

function need_skinny_mode() {
    if (window.matchMedia !== undefined) {
        return window.matchMedia("(max-width: 767px)").matches;
    } else {
        // IE<10 doesn't support window.matchMedia, so do this
        // as best we can without it.
        return window.innerWidth <= 767;
    }
}

function resizehandler(e) {
    var composebox = $("#compose");
    var top_statusbar = $("#top_statusbar");
    if (need_skinny_mode()) {
        var desired_width;
        if (exports.home_tab_obscured() === 'other_tab') {
            desired_width = $("div.tab-pane.active").outerWidth();
        } else {
            desired_width = $("#main_div").outerWidth();
            composebox.width(desired_width);
        }
        top_statusbar.width(desired_width);
    } else {
        top_statusbar.width('');
        composebox.width('');
    }

    $("#bottom_whitespace").height(viewport.height() * 0.4);
    $("#main_div").css('min-height', viewport.height() - $("#top_navbar").height());

    /* total viewport - height of navbar - height of upper sidebar - padding*/
    var bottom_sidebar_height = viewport.height() - $("#top_navbar").height() - $(".upper_sidebar").height() - 40;
    $(".bottom_sidebar").height(bottom_sidebar_height);

    $("#stream_filters").css('max-height', bottom_sidebar_height * 0.35);
    $("#user_presences").css('max-height', bottom_sidebar_height * 0.35);

    // This function might run onReady (if we're in a narrow window),
    // but before we've loaded in the messages; in that case, don't
    // try to scroll to one.
    if (selected_message_id !== -1) {
        scroll_to_selected();
    }
    // When the screen resizes, it may cause some messages to go off the screen
    notifications_bar.update();
}

$(function () {
    // When the user's profile picture loads this can change the height of the sidebar
    $("img.gravatar-profile").bind('load', resizehandler);

    // We don't have a stream list at MIT.
    if (domain === "mit.edu") {
        $("#stream_filters").remove();
        $("#stream_filters_sep").remove();
    }
});

var is_floating_recipient_bar_showing = false;

function show_floating_recipient_bar() {
    if (!is_floating_recipient_bar_showing) {
        $(".floating_recipient_bar").css('visibility', 'visible');
        is_floating_recipient_bar_showing = true;
    }
}

var old_label;
function replace_floating_recipient_bar(desired_label) {
    var new_label, other_label, header;
    if (desired_label !== old_label) {
        if (desired_label.children(".message_header_stream").length !== 0) {
            new_label = $("#current_label_stream");
            other_label = $("#current_label_private_message");
            header = desired_label.children(".message_header_stream.right_part");

            $("#current_label_stream td:first").css(
                "background-color",
                desired_label.children(".message_header_stream.right_part")
                             .css("background-color"));
        } else {
            new_label = $("#current_label_private_message");
            other_label = $("#current_label_stream");
            header = desired_label.children(".message_header_private_message.right_part");
        }
        new_label.find("td:last").replaceWith(header.clone());
        other_label.css('display', 'none');
        new_label.css('display', 'table-row');
        new_label.attr("zid", rows.id(desired_label));

        old_label = desired_label;
    }
    show_floating_recipient_bar();
}

function hide_floating_recipient_bar() {
    if (is_floating_recipient_bar_showing) {
        $(".floating_recipient_bar").css('visibility', 'hidden');
        is_floating_recipient_bar_showing = false;
    }
}

exports.update_floating_recipient_bar = function () {
    var top_statusbar = $("#top_statusbar");
    var top_statusbar_top = top_statusbar.offset().top;
    var top_statusbar_bottom = top_statusbar_top + top_statusbar.outerHeight();

    // Find the last message where the top of the recipient
    // row is at least partially occluded by our box.
    // Start with the pointer's current location.
    var candidate = selected_message;
    if (candidate === undefined) {
        return;
    }
    while (true) {
        candidate = candidate.prev();
        if (candidate.length === 0) {
            // We're at the top of the page and no labels are above us.
            hide_floating_recipient_bar();
            return;
        }
        if (candidate.is(".focused_table .recipient_row")) {
            if (candidate.offset().top < top_statusbar_bottom) {
                break;
            }
        }
    }
    var current_label = candidate;

    // We now know what the floating stream/subject bar should say.
    // Do we show it?

    // Hide if the bottom of our floating stream/subject label is not
    // lower than the bottom of current_label (since that means we're
    // covering up a label that already exists).
    if (top_statusbar_bottom <=
        (current_label.offset().top + current_label.outerHeight())) {
        hide_floating_recipient_bar();
        return;
    }

    // Hide if our bottom is in our bookend (or one bookend-height
    // above it). This means we're not showing any useful part of the
    // message above us, so why bother showing the label?
    var current_bookend = current_label.nextUntil(".bookend_tr")
                                       .andSelf()
                                       .next(".bookend_tr:first");
    // (The last message currently doesn't have a bookend, which is why this might be 0).
    if (current_bookend.length > 0) {
        if (top_statusbar_bottom >
            (current_bookend.offset().top - current_bookend.outerHeight())) {
            hide_floating_recipient_bar();
            return;
        }
    }

    replace_floating_recipient_bar(current_label);
};

function hack_for_floating_recipient_bar() {
    // So, as of this writing, Firefox respects visibility: collapse,
    // but WebKit does not (at least, my Chrome doesn't.)  Instead it
    // renders it basically as visibility: hidden, which leaves a
    // slight gap that our messages peek through as they scroll
    // by. This hack fixes this by programmatically measuring how big
    // the gap is, and then moving our table up to compensate.
    var gap = $("#floating_recipient_layout_row").outerHeight(true);
    var floating_recipient = $(".floating_recipient");
    var offset = floating_recipient.offset();
    offset.top = offset.top - gap;
    floating_recipient.offset(offset);
}

exports.show_api_key_box = function () {
    $("#get_api_key_box").show();
    $("#api_key_button_box").hide();
};

var current_actions_popover_elem;
function show_actions_popover(element, id) {
    var last_popover_elem = current_actions_popover_elem;
    ui.hide_actions_popover();
    if (last_popover_elem !== undefined
        && last_popover_elem.get()[0] === element) {
        // We want it to be the case that a user can dismiss a popover
        // by clicking on the same element that caused the popover.
        return;
    }

    select_message_by_id(id);
    var elt = $(element);
    if (elt.data('popover') === undefined) {
        var args = {
            message:  message_dict[id],
            narrowed: narrow.active()
        };

        var ypos = elt.offset().top - viewport.scrollTop();
        elt.popover({
            placement: (ypos > (viewport.height() - 300)) ? 'top' : 'bottom',
            title:     templates.actions_popover_title(args),
            content:   templates.actions_popover_content(args),
            trigger:   "manual"
        });
        elt.popover("show");
        current_actions_popover_elem = elt;
    }
}

exports.hide_actions_popover = function () {
    if (ui.actions_currently_popped()) {
        current_actions_popover_elem.popover("destroy");
        current_actions_popover_elem = undefined;
    }
};

exports.actions_currently_popped = function () {
    return current_actions_popover_elem !== undefined;
};

function update_gravatars() {
    $.each($(".gravatar-profile"), function (index, profile) {
        $(this).attr('src', $(this).attr('src') + '?stamp=' + gravatar_stamp);
    });
    gravatar_stamp += 1;
}

function poll_for_gravatar_update(start_time, url) {
    var updated = false;

    $.ajax({
        type: "HEAD",
        url: url,
        async: false,
        cache: false,
        success: function (resp, statusText, xhr) {
            if (new Date(xhr.getResponseHeader('Last-Modified')) > start_time) {
                update_gravatars();
                updated = true;
            }
        }
    });

    // Give users 5 minutes to update their picture on gravatar.com,
    // during which we try to auto-update their image on our site. If
    // they take longer than that, we'll update when they press the
    // save button.
    if (!updated && (($.now() - start_time) < 1000 * 60 * 5)) {
        setTimeout(function () {
            poll_for_gravatar_update(start_time, url);
        }, 1500);
    }
}

exports.get_gravatar_stamp = function () {
    return gravatar_stamp;
};

exports.wait_for_gravatar = function () {
    poll_for_gravatar_update($.now(), $(".gravatar-profile").attr("src"));
};

var loading_more_messages_indicator_showing = false;
exports.show_loading_more_messages_indicator = function () {
    if (! loading_more_messages_indicator_showing) {
        util.make_loading_indicator($('#loading_more_messages_indicator'));
        loading_more_messages_indicator_showing = true;
        hide_floating_recipient_bar();
    }
};

exports.hide_loading_more_messages_indicator = function () {
    if (loading_more_messages_indicator_showing) {
        util.destroy_loading_indicator($("#loading_more_messages_indicator"));
        loading_more_messages_indicator_showing = false;
    }
};

$(function () {
    // NB: This just binds to current elements, and won't bind to elements
    // created after ready() is called.

    // Prepare the click handler for subbing to a new stream to which
    // you have composed a message.
    $('#create-it').click(function () {
        subs.subscribe_for_send(compose.stream_name(), $('#stream-dne'));
    });

    // Prepare the click handler for subbing to an existing stream.
    $('#sub-it').click(function () {
        subs.subscribe_for_send(compose.stream_name(), $('#stream-nosub'));
    });

    function scroll_finished() {
        keep_pointer_in_view();
        hotkeys.in_scroll_caused_by_keypress = false;
        exports.update_floating_recipient_bar();
        if ($('#home').hasClass('active')) {
            if (viewport.scrollTop() === 0 &&
                have_scrolled_away_from_top) {
                have_scrolled_away_from_top = false;
                load_more_messages();
            } else if (!have_scrolled_away_from_top) {
                have_scrolled_away_from_top = true;
            }
            // When the window scrolls, it may cause some messages to go off the screen
            notifications_bar.update();
        }
    }

    var scroll_timer;
    function scroll_finish() {
        clearTimeout(scroll_timer);
        scroll_timer = setTimeout(scroll_finished, 100);
    }

    $(window).scroll($.throttle(50, function (e) {
        if (!hotkeys.in_scroll_caused_by_keypress) {
            // Only hide the recipient bar when mousewheel/trackpad scrolling,
            // not when going through messages one by one with the arrow
            // keys.
            hide_floating_recipient_bar();
        }
        scroll_finish();
    }));

    var throttled_mousewheelhandler = $.throttle(50, function (e, delta) {
        // Most of the mouse wheel's work will be handled by the
        // scroll handler, but when we're at the top or bottom of the
        // page, the pointer may still need to move.
        move_pointer_at_page_top_and_bottom(delta);
    });

    $(window).mousewheel(function (e, delta) {
        // Ignore mousewheel events if a modal is visible.  It's weird if the
        // user can scroll the main view by wheeling over the greyed-out area.
        // Similarly, ignore events on settings page etc.
        //
        // We don't handle the compose box here, because it *should* work to
        // select the compose box and then wheel over the message stream.
        var obscured = exports.home_tab_obscured();
        if (!obscured) {
            throttled_mousewheelhandler(e, delta);
        } else if (obscured === 'modal') {
            // The modal itself has a handler invoked before this one (see below).
            // preventDefault here so that the tab behind the modal doesn't scroll.
            //
            // This needs to include the events that would be ignored by throttling.
            // That's why this code can't be moved into throttled_mousewheelhandler.
            e.preventDefault();
        }
        // If on another tab, we neither handle the event nor preventDefault, allowing
        // the tab to scroll normally.
    });

    $(window).resize($.throttle(50, resizehandler));

    // Scrolling in modals, input boxes, and other elements that
    // explicitly scroll should not scroll the main view.  Stop
    // propagation in all cases.  Also, ignore the event if the
    // element is already at the top or bottom.  Otherwise we get a
    // new scroll event on the parent (?).
    $('.modal-body, .scrolling_list, input, textarea').mousewheel(function (e, delta) {
        var self = $(this);
        var scroll = self.scrollTop();
        e.stopPropagation();
        if (   ((delta > 0) && (scroll <= 0))
            || ((delta < 0) && (scroll >= (this.scrollHeight - self.innerHeight())))) {
            e.preventDefault();
        }
    });

    // Ignore wheel events in the compose area which weren't already handled above.
    $('#compose').mousewheel(function (e) {
        e.stopPropagation();
        e.preventDefault();
    });

    function clear_password_change() {
        // Clear the password boxes so that passwords don't linger in the DOM
        // for an XSS attacker to find.
        $('#old_password, #new_password, #confirm_password').val('');
    }

    // So, this is a rather inelegant hack that addresses two issues.
    //
    // The first issue goes something like this: we use Bootstrap's
    // notion of tabs to show what pane you're in.  Bootstrap likes to
    // highlight the active tab. Since "Settings", etc. are in our
    // dropdown, therefore the dropdown is the "active" tab, so we
    // draw it as though it is pushed in! However, this is
    // inappropriate for what we're trying to do.  (we're trying to
    // give you a menu, not indicate where you are; and undoing this
    // and doing all the tab work by hand is just unnecessarily
    // painful.)
    //
    // So to get around this, we take away the "active" status of
    // gear-menu every single time a tab is shown.
    $('#gear-menu a[data-toggle="tab"]').on('shown', function (e) {
        $('#gear-menu').removeClass('active');
    });
    // Doing so ends up causing some other problem, though, where the
    // little 'active' indicators get stuck on the menu sub-items, so
    // we need to flush the old ones too once a new one is
    // activated. (Otherwise, once you've been to a tab you can never
    // go to it again).
    //
    // Incidentally, this also fixes a problem we have with
    // e.relatedTarget; if you don't do the clearing as specified
    // above, e.relatedTarget always ends up being the last link in
    // our dropdown, as opposed to "the previously selected menu
    // item."
    $('#gear-menu a[data-toggle="tab"]').on('show', function (e) {
        $('#gear-menu li').removeClass('active');
    });

    $('#gear-menu a[data-toggle="tab"]').on('show', function (e) {
        // Save the position of our old tab away, before we switch
        var old_tab = $(e.relatedTarget).attr('href');
        scroll_positions[old_tab] = viewport.scrollTop();
    });
    $('#gear-menu a[data-toggle="tab"]').on('shown', function (e) {
        var target_tab = $(e.target).attr('href');

        // Hide all our error messages when switching tabs
        $('.alert-error').hide();
        $('.alert-success').hide();
        $('.alert-info').hide();
        $('.alert').hide();

        $("#api_key_value").text("");
        $("#get_api_key_box").hide();
        $("#show_api_key_box").hide();
        $("#api_key_button_box").show();

        clear_password_change();

        // Set the URL bar title to show the sub-page you're currently on.
        var browser_url = target_tab;
        if (browser_url === "#home") {
            browser_url = "";
        }
        hashchange.changehash(browser_url);

        // After we show the new tab, restore its old scroll position
        // (we apparently have to do this after setting the hash,
        // because otherwise that action may scroll us somewhere.)
        if (scroll_positions.hasOwnProperty(target_tab)) {
            viewport.scrollTop(scroll_positions[target_tab]);
        } else {
            if (target_tab === '#home') {
                scroll_to_selected();
            } else {
                viewport.scrollTop(0);
            }
        }
    });

    // N.B. that subs.setup_page calls focus() on our stream textbox,
    // which may cause the page to scroll away from where we used to
    // have it (and instead to scroll to a weird place.)
    $('#gear-menu a[href="#subscriptions"]').on('shown', subs.setup_page);

    var settings_status = $('#settings-status');
    $("#settings-change-box form").ajaxForm({
        dataType: 'json', // This seems to be ignored. We still get back an xhr.
        success: function (resp, statusText, xhr, form) {
            var message = "Updated settings!";
            var result = $.parseJSON(xhr.responseText);

            if (result.full_name !== undefined) {
                $(".my_fullname").text(result.full_name);
            }
            update_gravatars();

            if (result.enable_desktop_notifications !== undefined) {
                desktop_notifications_enabled = result.enable_desktop_notifications;
            }

            settings_status.removeClass(status_classes)
                .addClass('alert-success')
                .text(message).stop(true).fadeTo(0,1);
            // TODO: In theory we should auto-reload or something if
            // you changed the email address or other fields that show
            // up on all screens
        },
        error: function (xhr, error_type, xhn) {
            var response = "Error changing settings";
            if (xhr.status.toString().charAt(0) === "4") {
                // Only display the error response for 4XX, where we've crafted
                // a nice response.
                response += ": " + $.parseJSON(xhr.responseText).msg;
            }
            settings_status.removeClass(status_classes)
                .addClass('alert-error')
                .text(response).stop(true).fadeTo(0,1);
        },
        complete: function (xhr, statusText) {
            // Whether successful or not, clear the password boxes.
            // TODO: Clear these earlier, while the request is still pending.
            clear_password_change();
        }
    });

    $("#get_api_key_box").hide();
    $("#show_api_key_box").hide();
    $("#get_api_key_box form").ajaxForm({
        dataType: 'json', // This seems to be ignored. We still get back an xhr.
        success: function (resp, statusText, xhr, form) {
            var message = "Updated settings!";
            var result = $.parseJSON(xhr.responseText);
            $("#get_api_key_password").val("");
            $("#api_key_value").text(result.api_key);
            $("#show_api_key_box").show();
            $("#get_api_key_box").hide();
            settings_status.hide();
        },
        error: function (xhr, error_type, xhn) {
            var response = "Error getting API key";
            if (xhr.status.toString().charAt(0) === "4") {
                // Only display the error response for 4XX, where we've crafted
                // a nice response.
                response += ": " + $.parseJSON(xhr.responseText).msg;
            }
            settings_status.removeClass(status_classes)
                .addClass('alert-error')
                .text(response).stop(true).fadeTo(0,1);
            $("#show_api_key_box").hide();
            $("#get_api_key_box").show();
        }
    });

    // A little hackish, because it doesn't seem to totally get us
    // the exact right width for the top_statusbar and compose box,
    // but, close enough for now.
    resizehandler();
    hack_for_floating_recipient_bar();

    typeahead_helper.update_all_recipients(people_list);
    composebox_typeahead.initialize();
    search.initialize();
    notifications.initialize();
    hashchange.initialize();
    invite.initialize();
    activity.initialize();

    $("body").bind('click', function () {
        ui.hide_actions_popover();
    });

    $("#main_div").on("click", ".messagebox", function (e) {
        if ($(e.target).is("a")) {
            // If this click came from a hyperlink, don't trigger the
            // reply action.  The simple way of doing this is simply
            // to call e.stopPropagation() from within the link's
            // click handler.
            //
            // Unfortunately, on Firefox, this breaks Ctrl-click and
            // Shift-click, because those are (apparently) implemented
            // by adding an event listener on link clicks, and
            // stopPropagation prevents them from being called.
            return;
        }
        if (!(clicking && mouse_moved)) {
            // Was a click (not a click-and-drag).
            var row = $(this).closest(".message_row");
            select_message_by_id(rows.id(row));
            respond_to_message();
        }
        mouse_moved = false;
        clicking = false;
    });

    $("#main_div").on("mousedown", ".messagebox", mousedown);
    $("#main_div").on("mousemove", ".messagebox", mousemove);
    $("#main_div").on("mouseover", ".messagebox", function (e) {
        var row = $(this).closest(".message_row");
        message_hover(row);
    });

    $("#main_div").on("mouseout", ".messagebox", function (e) {
        message_unhover();
    });

    $("#main_div").on("mouseover", ".actions_hover", function (e) {
        var row = $(this).closest(".message_row");
        message_hover(row);
        row.addClass("actions_hovered");
    });

    $("#main_div").on("mouseout", ".actions_hover", function (e) {
        var row = $(this).closest(".message_row");
        message_unhover();
        row.removeClass("actions_hovered");
    });

    $("#main_div").on("click", ".actions_hover", function (e) {
        var row = $(this).closest(".message_row");
        e.stopPropagation();
        show_actions_popover(this, rows.id(row));
    });

    $("#home").on("click", ".narrows_by_recipient", function (e) {
        var row = $(this).closest(".recipient_row");
        narrow.by_recipient(rows.id(row));
    });

    $("#home").on("click", ".narrows_by_subject", function (e) {
        var row = $(this).closest(".recipient_row");
        narrow.by_subject(rows.id(row));
    });

    $("#subscriptions_table").on("mouseover", ".subscription_header", function (e) {
        $(this).addClass("active");
    });

    $("#subscriptions_table").on("mouseout", ".subscription_header", function (e) {
        $(this).removeClass("active");
    });

    $("#search_query").on("focus", search.focus_search);
    $("#search_query").on("blur", search.update_button_visibility);
    $("#search_up")  .on("click", function () { search.search_button_handler(true); });
    $("#search_down").on("click", function () { search.search_button_handler(false); });
    $("#search_exit").on("click", search.clear_search);

    $("#stream").on('blur', function () { compose.decorate_stream_bar(this.value); });

    $("a.brand").on('click', function (e) {
        if (exports.home_tab_obscured()) {
            ui.change_tab_to('#home');
        } else {
            narrow.restore_home_state();
        }
        e.preventDefault();
    });

    $(window).on('blur', function () {
        $(document.body).addClass('window_blurred');
    });

    $(window).on('focus', function () {
        $(document.body).removeClass('window_blurred');
    });
});

function sort_narrow_list() {
    var items = $('#stream_filters li').get();
    var div = $('#stream_filters');
    items.sort(function(a,b){
        var keyA = $(a).text();
        var keyB = $(b).text();

        if (keyA < keyB) return -1;
        if (keyA > keyB) return 1;
        return 0;
    });

    div.empty();

    $.each(items, function(i, li){
          div.append(li);
    });
}

exports.get_filter_li = function(type, name) {
    return $("#" + type + "_filters li[data-name='" + encodeURIComponent(name) + "']");
};

exports.add_narrow_filter = function(name, type, uri) {
    var list_item;

    /*
     * We don't give MIT a stream list currently since that would likely be
     * overwhelming for users given the vast number of streams MIT users are
     * commonly subscribed to.
     *
     * This will not be as much of an issue once we do prioritization of streams
     * in the list.
     */
    if (domain === "mit.edu" && type === "stream") {
        return false;
    }

    if (exports.get_filter_li(type, name).length) {
        // already exists
        return false;
    }


    list_item = $('<li>').attr('data-name', encodeURIComponent(name))
                         .html($('<a>').attr('href', uri)
                                       .addClass('subscription_name')
                                       .text(name)
                                       .append('<span class="count">(<span class="value"></span>)</span>'));
    if (type === "stream" && subs.have(name).invite_only) {
        list_item.append("<i class='icon-lock'/>");
    }
    $("#" + type + "_filters").append(list_item);
    sort_narrow_list();
};

exports.get_count = function (type, name) {
    return exports.get_filter_li(type, name).find('.count .value').text();
};

exports.set_count = function (type, name, count) {
    var count_span = exports.get_filter_li(type, name).find('.count');
    var value_span = count_span.find('.value');

    if (count === 0) {
        return exports.clear_count(type, name);
    }
    count_span.show();

    value_span.text(count);
};

exports.clear_count = function (type, name) {
    exports.get_filter_li(type, name).find('.count').hide()
                                                    .find('.value').text('');
};

exports.remove_narrow_filter = function (name, type) {
    exports.get_filter_li(type, name).remove();
};

exports.set_presence_list = function(users, presence_info) {
    $('#user_presences').empty();

    var create_user = function(name, email) {
        return $('<li>').html($('<a>').attr('href', '#')
                                          .text(name))
                                          .click(function(e) {
                                              compose.start('private', {'private_message_recipient': email});
                                              e.preventDefault();
                                          });
    };

    $('#user_presences').append(create_user(fullname, email).addClass('active-icon'));

    $.each(users, function(idx, email) {
        if (people_dict[email] === undefined) {
            return;
        }

        var user = create_user(people_dict[email].full_name, email);

        switch (presence_info[email]) {
            case activity.user_active:
                user.addClass('active-icon');
                break;
            case activity.user_away:
                user.addClass('away-icon');
                break;
            case activity.user_idle:
                user.addClass('idle-icon');
                break;
        }

        $('#user_presences').append(user);
    });
};

function add_font_size(offset, name) {
    var style = {
        'font-size':   (14 + 3*offset) + 'px',
        'line-height': (20 + 3*offset) + 'px'
    };

    var entry = $('<li>').append(
        $('<a href="#">')
            .text(name)
            .css(style)
            .click(function (e) {
                $('body').css(style);
                scroll_to_selected();
                e.preventDefault();
            }));

    $('#font_size_menu').append(entry);
}

$(function () {
    // Create font size menu entries
    add_font_size(-1, 'Small'  );
    add_font_size( 0, 'Medium' );
    add_font_size( 1, 'Large'  );
    add_font_size( 3, 'Larger' );
    add_font_size( 5, 'Largest');

    // The entry that produces the submenu has a href
    // for style, but we don't want to navigate on click.
    $('#font_size_menu_link').click(function (e) {
        e.preventDefault();
    });
});

return exports;
}());
