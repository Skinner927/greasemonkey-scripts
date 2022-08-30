// ==UserScript==
// @name         Snipe-IT Dymo Printer
// @namespace    https://github.com/Skinner927/greasemonkey-scripts
// @version      0.5
// @description  Add Dymo printer support to Snipe IT.
// @author       skinner927
// @updateURL    https://github.com/Skinner927/greasemonkey-scripts/raw/master/dymo-snipe-it/print.user.js
// @match        https://*.snipe-it.io/hardware/bulkedit
// @icon         https://www.google.com/s2/favicons?domain=snipeitapp.com
// @require      https://yestacos.com/raw/Nycto/PicoModal/master/src/picoModal.js
// @grant        GM_addStyle
// @grant        GM_addElement
// ==/UserScript==

/**
 * Changelog
 * 0.5
 *   - Pin broken framework.js url.
 * 0.4
 *   - Update script URLs as GitHub has added x-content-type-options headers.
 * 0.3
 *   - Update icon domain
 */

(function() {
  'use strict';

  GM_addStyle(`
button, option, select {
  cursor: pointer;
}

.dymo-print-btn {
  display: block;
  position: fixed;
  top: 20px;
  right: 20px;
  font-size: 2em;
  color: black;
}

@media print {
  .hidden-print {
    display: none !important;
  }
}
  `);
  var FIELD_QR_IMG = 'QR_IMG';
  var FIELD_TEXT = 'TEXT';

  var globalPrintingInProgress = false;
  var globalParsedLabels = null;

  var MODAL_NO_CLOSE = {
    closeButton: false,
    overlayClose: false,
    escCloses: false,
  };
  function modalAlert(msg) {
    return picoModal(msg)
      .afterClose(function(modal) { modal.destroy(); })
      .show();
  }

  function modalProgress(msg, start, end, cbOnShow) {
    var updateMe = document.createElement('span');
    updateMe.innerText = start;

    var outerModal = null;
    outerModal = picoModal(Object.assign({
      content: '<p style="text-align:center">' + msg + '</p>' +
        '<p style="text-align:center"><span class="put-update-here"></span> / ' + end + '</p>',
    }, MODAL_NO_CLOSE))
      .afterCreate((modal) => {
        modal.modalElem().querySelector('span.put-update-here').appendChild(updateMe);
      })
      .afterShow(function(modal) {
        if (cbOnShow) {
          modal.update = function(newValue) {
            updateMe.innerText = newValue;
          };
          cbOnShow(modal);
        }
      })
      .afterClose(function(modal) { modal.destroy(); })
      .show();

    // do this again because afterShow is potentially a race condition
    outerModal.update = function(newValue) {
      updateMe.innerText = newValue;
    };

    return outerModal;
  }

  function cleanup() {
    globalPrintingInProgress = false;
  }

  function die(msg) {
    modalAlert(msg);
    cleanup();
  }

  function imageToPngBase64(img) {
    // Create canvas
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    // Set width and height
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    // Draw the image
    ctx.drawImage(img, 0, 0);
    var data = canvas.toDataURL('image/png').substr('data:image/png;base64,'.length);
    canvas.remove();
    return data;
  }

  function doPrint(printer, layoutId, labels) {
    picoModal(Object.assign({
      content: 'Sending print job to printer...'
    }, MODAL_NO_CLOSE))
      .afterShow(function(modal) {
        var layout = LAYOUTS[layoutId];
        console.log('PRINT', printer, layoutId, labels);

        var printParams = dymo.label.framework.createLabelWriterPrintParamsXml({
          copies: 1,
        });
        var builder = new dymo.label.framework.LabelSetBuilder();
        labels.forEach(function(label) {
          var record = builder.addRecord();
          record.setBase64Image(FIELD_QR_IMG, label.qr);
          record.setText(FIELD_TEXT, label.text);
        });
        dymo.label.framework.printLabel(printer, printParams, layout.layout, builder.toString());
        modal.close();
        cleanup();
      })
      .afterClose(function(modal) { modal.destroy(); })
      .show();
  }

  function buildLabelArray(done) {
    if (globalParsedLabels) {
      done(globalParsedLabels);
      return;
    }
    // pull all labels off the page
    var $labels = document.querySelectorAll('body div.label');
    if ($labels.length === 0) {
      return die('Error: No labels found on the page');
    }

    // We used to download QR codes, but it didn't work, but I'm not going to alter
    // the logic on this.
    modalProgress('Downloading label QR codes...', 0, $labels.length, function(modal) {
      var labels = [];
      for (var i = 0; i < $labels.length; i++) {
        modal.update(i + 1);
        var $qrImage = $labels[i].querySelector('div.qr_img img');
        //var qrData = dymo.label.framework.loadImageAsPngBase64($qrImage.src);
        // TODO: this should verify the image is actually loaded
        var qrData = imageToPngBase64($qrImage);

        var lines = $labels[i].querySelector('div.qr_text')
          .textContent
          .split('\n')
          .map(x => x.trim())
          .filter(x => !!x)
          .join('\n');

        labels.push({
          qr: qrData,
          text: lines,
        });
      }
      globalParsedLabels = labels;
      modal.close();
      if (done) {
        done(labels);
      }
    });
  }

  function printerSelected(printer) {
    // we know the name of the printer, pull all labels off the page
    buildLabelArray(function(labels) {
      showPreview(printer, labels);
    });
  }

  function showPreview(printer, labels) {
    // Build layout selector & previewer
    var layoutSelect = document.createElement('select');
    LAYOUTS.forEach(function(layout, idx) {
      var option = document.createElement('option');
      option.value = idx
      option.appendChild(document.createTextNode(layout.label));
      layoutSelect.appendChild(option);
    });

    picoModal({
      content: '<p>Select label type & preview first label</p>' +
        '<p>Will print ' + labels.length + ' labels</p>' +
        '<img style="background:grey; padding:5px;" src="" class="preview"><br><br>' +
        '<div><label>Label type:</label> &nbsp;' +
        '<span class="put-select-here"></span></div><br>' +
        '<button type="button" class="cancel">Cancel</button>' +
        '<button type="button" style="float:right" class="ok">Print</button>'
    }).afterCreate((modal) => {
      var previewImage = modal.modalElem().querySelector('img.preview');
      function updatePreview() {
        var label = dymo.label.framework
          .openLabelXml(LAYOUTS[parseInt(layoutSelect.value, 10) || 0].layout);

        var first = labels[0];
        label.setObjectText(FIELD_QR_IMG, first.qr);
        label.setObjectText(FIELD_TEXT, first.text);

        var pngData = label.render(void 0, printer);
        previewImage.src = "data:image/png;base64," + pngData;
      }

      modal.modalElem().querySelector('span.put-select-here').appendChild(layoutSelect);
      modal.modalElem().addEventListener('click', (evt) => {
        if (evt.target && evt.target.matches('.ok')) {
          modal.close(true);
        } else if (evt.target && evt.target.matches('.cancel')) {
          modal.close();
        }
      });
      layoutSelect.addEventListener('change', updatePreview);
      // initial
      updatePreview();
    }).afterClose((modal, event) => {
      if (event.detail) {
        doPrint(printer, layoutSelect.value, labels);
      } else {
        cleanup();
      }
      modal.destroy();
    }).show();
  }

  function dymoLoaded() {
    // load printers
    var printers = dymo.label.framework.getPrinters();
    if (printers.length === 0) {
      return die('Error: No DYMO printers found');
    }

    if (printers.length === 1) {
      return printerSelected(printers[0].name);
    }

    var printerSelect = document.createElement('select');
    printers.forEach(function(printer) {
      var option = document.createElement('option');
      option.value = printer.name;
      option.appendChild(document.createTextNode(printer.name));
      printerSelect.appendChild(option);
    });

    picoModal({
      content: '<p>Select printer to use</p>' +
        '<div class="put-select-here"></div><br>' +
        '<button type="button" class="cancel">Cancel</button>' +
        '<button type="button" style="float:right" class="ok">Select</button>'
    }).afterCreate((modal) => {
      modal.modalElem().querySelector('div.put-select-here').appendChild(printerSelect);
      modal.modalElem().addEventListener('click', (evt) => {
        if (evt.target && evt.target.matches('.ok')) {
          modal.close(true);
        } else if (evt.target && evt.target.matches('.cancel')) {
          modal.close();
        }
      });
    }).afterClose((modal, event) => {
      if (event.detail) {
        printerSelected(printerSelect.value);
      } else {
        cleanup();
      }
      modal.destroy();
    }).show();
  }

  function startPrinting() {
    if (globalPrintingInProgress) {
      return void modalAlert('Printing in progress');
    }
    globalPrintingInProgress = true;
    dymo.label.framework.init(dymoLoaded);
  }

  // Dymo is loaded and ready, add the button to the screen
  function ready() {
    var btnStart = GM_addElement(document.body, 'button', {
      type: 'button',
      class: 'dymo-print-btn hidden-print'
    });
    btnStart.innerText = 'Print to Dymo';
    btnStart.addEventListener('click', startPrinting);
  }


  // Load dymo frame work and wait for it to be loaded.
  // For whatever reason I can't load this via @requires due to strict mode.
  // http://labelwriter.com/software/dls/sdk/docs/DYMOLabelFrameworkJavaScriptHelp/
  GM_addElement('script', {
    //src: 'https://raw.githubusercontent.com/dymosoftware/dymo-connect-framework/master/dymo.connect.framework.min.js',
    src: 'https://yestacos.com/raw/dymosoftware/dymo-connect-framework/cf7bced5280f95c7fb4f12f72abb27fc13526fbc/dymo.connect.framework.min.js',
    type: 'text/javascript',
    charset: 'UTF-8',
  });

  // Wait for dymo
  var wait = setInterval(() => {
    if (typeof dymo !== 'undefined') {
      clearInterval(wait);
      ready();
    }
  }, 100);

  var LAYOUTS = [{
    label: '30252 Address: 1-1/8" x 3-1/2" | 28mm x 89mm',
    layout: `<?xml version="1.0" encoding="utf-8"?>
    <DieCutLabel Version="8.0" Units="twips" MediaType="Default">
      <PaperOrientation>Landscape</PaperOrientation>
      <Id>Address</Id>
      <PaperName>30252 Address</PaperName>
      <DrawCommands>
        <RoundRectangle X="0" Y="0" Width="1581" Height="5040" Rx="270" Ry="270"/>
      </DrawCommands>
      <ObjectInfo>
        <ImageObject>
          <Name>QR_IMG</Name>
          <ForeColor Alpha="255" Red="0" Green="0" Blue="0"/>
          <BackColor Alpha="0" Red="255" Green="255" Blue="255"/>
          <LinkedObjectName></LinkedObjectName>
          <Rotation>Rotation0</Rotation>
          <IsMirrored>False</IsMirrored>
          <IsVariable>False</IsVariable>
          <Image></Image>
          <ScaleMode>Uniform</ScaleMode>
          <BorderWidth>0</BorderWidth>
          <BorderColor Alpha="255" Red="0" Green="0" Blue="0"/>
          <HorizontalAlignment>Center</HorizontalAlignment>
          <VerticalAlignment>Center</VerticalAlignment>
        </ImageObject>
        <Bounds X="331.2" Y="93.76251" Width="1113.878" Height="1399.037"/>
      </ObjectInfo>
      <ObjectInfo>
        <TextObject>
          <Name>TEXT</Name>
          <ForeColor Alpha="255" Red="0" Green="0" Blue="0"/>
          <BackColor Alpha="0" Red="255" Green="255" Blue="255"/>
          <LinkedObjectName></LinkedObjectName>
          <Rotation>Rotation0</Rotation>
          <IsMirrored>False</IsMirrored>
          <IsVariable>False</IsVariable>
          <HorizontalAlignment>Left</HorizontalAlignment>
          <VerticalAlignment>Middle</VerticalAlignment>
          <TextFitMode>ShrinkToFit</TextFitMode>
          <UseFullFontHeight>True</UseFullFontHeight>
          <Verticalized>False</Verticalized>
          <StyledText>
            <Element>
              <String></String>
              <Attributes>
                <Font Family="Helvetica" Size="13" Bold="False" Italic="False" Underline="False" Strikeout="False"/>
                <ForeColor Alpha="255" Red="153" Green="153" Blue="153"/>
              </Attributes>
            </Element>
          </StyledText>
        </TextObject>
        <Bounds X="1477.061" Y="57.59995" Width="3372.184" Height="1435.2"/>
      </ObjectInfo>
    </DieCutLabel>
    `,
  }, {
    label: '30332 Square: 1" x 1"',
    layout: `<?xml version="1.0" encoding="utf-8"?>
    <DieCutLabel Version="8.0" Units="twips" MediaType="Default">
      <PaperOrientation>Portrait</PaperOrientation>
      <Id>Small30332</Id>
      <PaperName>30332 1 in x 1 in</PaperName>
      <DrawCommands>
        <RoundRectangle X="0" Y="0" Width="1440" Height="1440" Rx="180" Ry="180"/>
      </DrawCommands>
      <ObjectInfo>
        <TextObject>
          <Name>TEXT</Name>
          <ForeColor Alpha="255" Red="0" Green="0" Blue="0"/>
          <BackColor Alpha="0" Red="255" Green="255" Blue="255"/>
          <LinkedObjectName></LinkedObjectName>
          <Rotation>Rotation0</Rotation>
          <IsMirrored>False</IsMirrored>
          <IsVariable>False</IsVariable>
          <HorizontalAlignment>Left</HorizontalAlignment>
          <VerticalAlignment>Middle</VerticalAlignment>
          <TextFitMode>AlwaysFit</TextFitMode>
          <UseFullFontHeight>True</UseFullFontHeight>
          <Verticalized>False</Verticalized>
          <StyledText>
            <Element>
              <String></String>
              <Attributes>
                <Font Family="Helvetica" Size="13" Bold="False" Italic="False" Underline="False" Strikeout="False"/>
                <ForeColor Alpha="255" Red="153" Green="153" Blue="153"/>
              </Attributes>
            </Element>
          </StyledText>
        </TextObject>
        <Bounds X="81.6" Y="825.8662" Width="1300.8" Height="527.7338"/>
      </ObjectInfo>
      <ObjectInfo>
        <ImageObject>
          <Name>QR_IMG</Name>
          <ForeColor Alpha="255" Red="0" Green="0" Blue="0"/>
          <BackColor Alpha="0" Red="255" Green="255" Blue="255"/>
          <LinkedObjectName></LinkedObjectName>
          <Rotation>Rotation0</Rotation>
          <IsMirrored>False</IsMirrored>
          <IsVariable>False</IsVariable>
          <Image></Image>
          <ScaleMode>Uniform</ScaleMode>
          <BorderWidth>0</BorderWidth>
          <BorderColor Alpha="255" Red="0" Green="0" Blue="0"/>
          <HorizontalAlignment>Center</HorizontalAlignment>
          <VerticalAlignment>Center</VerticalAlignment>
        </ImageObject>
        <Bounds X="81.6" Y="143.9999" Width="1300.8" Height="489.1621"/>
      </ObjectInfo>
    </DieCutLabel>`
  }];
})();
