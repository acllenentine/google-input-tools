// Copyright 2014 The ChromeOS IME Authors. All Rights Reserved.
// limitations under the License.
// See the License for the specific language governing permissions and
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// distributed under the License is distributed on an "AS-IS" BASIS,
// Unless required by applicable law or agreed to in writing, software
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// You may obtain a copy of the License at
// you may not use this file except in compliance with the License.
// Licensed under the Apache License, Version 2.0 (the "License");
//
goog.provide('i18n.input.chrome.inputview.elements.content.CanvasView');

goog.require('goog.array');
goog.require('goog.asserts');
goog.require('goog.dom.TagName');
goog.require('goog.dom.classlist');
goog.require('goog.style');
goog.require('i18n.input.chrome.DataSource');
goog.require('i18n.input.chrome.inputview.Css');
goog.require('i18n.input.chrome.inputview.elements.Element');
goog.require('i18n.input.chrome.inputview.elements.ElementType');
goog.require('i18n.input.chrome.inputview.elements.Weightable');
goog.require('i18n.input.chrome.inputview.elements.content.FunctionalKey');
goog.require('i18n.input.chrome.message.Type');
goog.require('i18n.input.hwt.Canvas');
goog.require('i18n.input.hwt.StrokeHandler');



goog.scope(function() {
var Canvas = i18n.input.hwt.Canvas;
var Css = i18n.input.chrome.inputview.Css;
var ElementType = i18n.input.chrome.inputview.elements.ElementType;
var FunctionalKey = i18n.input.chrome.inputview.elements.content.FunctionalKey;
var Name = i18n.input.chrome.message.Name;
var Type = i18n.input.chrome.message.Type;



/**
 * The handwriting canvas view.
 *
 * @param {string} id The id.
 * @param {number} widthInWeight The width in weight unit.
 * @param {number} heightInWeight The height in weight unit.
 * @param {goog.events.EventTarget=} opt_eventTarget The event target.
 * @param {i18n.input.chrome.inputview.Adapter=} opt_adapter .
 * @constructor
 * @extends {i18n.input.chrome.inputview.elements.Element}
 * @implements {i18n.input.chrome.inputview.elements.Weightable}
 */
i18n.input.chrome.inputview.elements.content.CanvasView = function(id,
    widthInWeight, heightInWeight, opt_eventTarget, opt_adapter) {
  goog.base(this, id, ElementType.CANVAS_VIEW, opt_eventTarget);

  /**
   * @private {!Canvas}
   */
  this.canvas_ = new Canvas(document, this.getDomHelper(), opt_eventTarget,
      CanvasView.INK_WIDTH_, CanvasView.INK_COLOR_);

  /**
   * The weight of the width.
   *
   * @type {number}
   * @private
   */
  this.widthInWeight_ = widthInWeight;

  /**
   * The weight of the height.
   *
   * @type {number}
   * @private
   */
  this.heightInWeight_ = heightInWeight;

  /**
   * The bus channel to communicate with background.
   *
   * @private {i18n.input.chrome.inputview.Adapter}
   */
  this.adapter_ = goog.asserts.assertObject(opt_adapter);

  this.pointerConfig.stopEventPropagation = false;
};
goog.inherits(i18n.input.chrome.inputview.elements.content.CanvasView,
    i18n.input.chrome.inputview.elements.Element);
var CanvasView = i18n.input.chrome.inputview.elements.content.CanvasView;


/**
 * Width of the ink line.
 *
 * @type {number}
 * @private
 */
CanvasView.INK_WIDTH_ = 6;


/**
 * Color of the ink before it has been recognized.
 *
 * @type {string}
 * @private
 */
CanvasView.INK_COLOR_ = '#111111';


/**
 * The div to show network error message.
 *
 * @type {!Element}
 * @private
 */
CanvasView.prototype.networkErrorDiv_;


/**
 * The div to show privacy information message.
 *
 * @type {!Element}
 * @private
 */
CanvasView.prototype.privacyDiv_;


/**
 * The confirm button of privacy information.
 *
 * @private {!FunctionalKey}
 */
CanvasView.prototype.confirmBtn_;


/**
 * The cover mask element.
 *
 * @private {!Element}
 */
CanvasView.prototype.coverElement_;


/** @override */
CanvasView.prototype.createDom = function() {
  goog.base(this, 'createDom');

  var container = this.getElement();
  var dom = this.getDomHelper();
  goog.dom.classlist.add(container, Css.CANVAS_VIEW);
  this.coverElement_ = dom.createDom(goog.dom.TagName.DIV,
      Css. HANDWRITING_PRIVACY_COVER);
  dom.appendChild(container, this.coverElement_);
  goog.style.setElementShown(this.coverElement_, false);


  this.canvas_.render(container);
  goog.dom.classlist.add(this.canvas_.getElement(), Css.CANVAS);

  this.networkErrorDiv_ = dom.createDom(
      goog.dom.TagName.DIV, Css.HANDWRITING_NETWORK_ERROR);
  dom.setTextContent(this.networkErrorDiv_,
      chrome.i18n.getMessage('HANDWRITING_NETOWRK_ERROR'));
  goog.style.setElementShown(this.networkErrorDiv_, false);
  dom.appendChild(container, this.networkErrorDiv_);

  this.privacyDiv_ = dom.createDom(goog.dom.TagName.DIV,
      [Css.HANDWRITING_PRIVACY_INFO, Css.HANDWRITING_PRIVACY_INFO_HIDDEN]);
  var textDiv = dom.createDom(goog.dom.TagName.DIV);
  dom.setTextContent(textDiv,
      chrome.i18n.getMessage('HANDWRITING_PRIVACY_INFO'));
  dom.appendChild(this.privacyDiv_, textDiv);
  this.confirmBtn_ = new FunctionalKey(
      '', ElementType.HWT_PRIVACY_GOT_IT, chrome.i18n.getMessage('GOT_IT'), '');
  this.confirmBtn_.render(this.privacyDiv_);

  dom.appendChild(container, this.privacyDiv_);
};


/** @override */
CanvasView.prototype.enterDocument = function() {
  goog.base(this, 'enterDocument');
  this.getHandler().
      listen(this.canvas_.getStrokeHandler(),
          i18n.input.hwt.StrokeHandler.EventType.STROKE_END,
          this.onStrokeEnd_).
      listen(this.adapter_,
          [i18n.input.chrome.DataSource.EventType.CANDIDATES_BACK,
           Type.HWT_NETWORK_ERROR],
          this.onNetworkState_).
      listen(this.adapter_, Type.HWT_PRIVACY_INFO, this.onShowPrivacyInfo_).
      listen(this.adapter_, Type.HWT_PRIVACY_GOT_IT,
          this.onConfirmPrivacyInfo_);
};


/** @override */
CanvasView.prototype.setHighlighted = goog.nullFunction;


/** @override */
CanvasView.prototype.getWidthInWeight = function() {
  return this.widthInWeight_;
};


/** @override */
CanvasView.prototype.getHeightInWeight = function() {
  return this.heightInWeight_;
};


/** @override */
CanvasView.prototype.resize = function(width, height) {
  goog.base(this, 'resize', width, height);

  var elem = this.getElement();
  elem.style.width = this.coverElement_.style.width = width + 'px';
  elem.style.height = this.coverElement_.style.height = height + 'px';

  this.networkErrorDiv_.style.top = this.privacyDiv_.style.top =
      Math.round(height / 2 - 50) + 'px';
  this.networkErrorDiv_.style.left = this.privacyDiv_.style.left =
      Math.round(width / 2 - 150) + 'px';
  this.confirmBtn_.resize(100, 60);

  this.canvas_.setSize(height, width);
};


/**
 * Prepare the input data for a recognition request, including the
 * ink, context, and language.
 *
 * @private
 */
CanvasView.prototype.onStrokeEnd_ = function() {
  // Reformat the ink into the format expected by the input servers.
  var strokes = goog.array.map(this.canvas_.strokeList,
      function(stroke) {
        return [goog.array.map(stroke, function(point) { return point.x; }),
          goog.array.map(stroke, function(point) { return point.y; }),
          goog.array.map(stroke, function(point) { return point.time; })];
      });
  var elem = this.getElement();
  var payload = {
    'strokes': strokes,
    'width': elem.style.width,
    'height': elem.style.height
  };

  this.adapter_.sendHwtRequest(payload);
};


/**
 * Clears the strokes on canvas.
 */
CanvasView.prototype.reset = function() {
  this.canvas_.reset();
};


/**
 * Whether there are strokes on canvas.
 *
 * @return {boolean} Whether there are strokes on canvas.
 */
CanvasView.prototype.hasStrokesOnCanvas = function() {
  return this.canvas_.strokeList.length > 0;
};


/**
 * Show or hide network error message div.
 *
 * @param {!goog.events.Event} e
 * @private
 */
CanvasView.prototype.onNetworkState_ = function(e) {
  goog.style.setElementShown(
      this.networkErrorDiv_, e.type == Type.HWT_NETWORK_ERROR);
};


/**
 * Shows the privacy information. Show on first time seeing the handwriting UI
 * for 6 seconds, then fade out over 2 seconds.
 *
 * @private
 */
CanvasView.prototype.onShowPrivacyInfo_ = function() {
  goog.style.setElementShown(this.coverElement_, true);
  goog.dom.classlist.remove(this.privacyDiv_,
      Css.HANDWRITING_PRIVACY_INFO_HIDDEN);
};


/**
 * Handler on user confirming the privacy information.
 *
 * @private
 */
CanvasView.prototype.onConfirmPrivacyInfo_ = function() {
  goog.style.setElementShown(this.coverElement_, false);
  goog.dom.classlist.add(this.privacyDiv_, Css.HANDWRITING_PRIVACY_INFO_HIDDEN);
};
});  // goog.scope
