// Copyright (C) 2014-2015 Lester Carballo Pérez <lestcape@gmail.com>
//
// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU General Public License
// as published by the Free Software Foundation; either version 2
// of the License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program; if not, write to the Free Software
// Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.

const St = imports.gi.St;
const Cogl = imports.gi.Cogl;
const Clutter = imports.gi.Clutter;
const Cinnamon = imports.gi.Cinnamon;
const Atk = imports.gi.Atk;
const Lang = imports.lang;
const Signals = imports.signals;
const Mainloop = imports.mainloop;
const Meta = imports.gi.Meta;
const Params = imports.misc.params;
const GdkPixbuf = imports.gi.GdkPixbuf;
const Gdk = imports.gi.Gdk;
const DND = imports.ui.dnd;
//const Cairo = imports.cairo;

const Main = imports.ui.main;

const SLIDER_SCROLL_STEP = 0.05; /* Slider scrolling step in % */

function ColorChooser() {
   this._init.apply(this, arguments);
}

ColorChooser.prototype = {
   _init: function(menu) {
      try {
         this.menu = menu;
         let [res, color] = Clutter.Color.from_string("#FF000000");
         this.selectedColor = color;

         this.spectrum = new ScaleSpectrum(this.selectedColor, [2, -1, 3, -2, 1, -3]);
         this.spectrum.connect('color-change', Lang.bind(this, this._onSpectrumColorChange));
         this.gradient = new GradientSelector(this.selectedColor);
         this.gradient.connect('color-change', Lang.bind(this, this._onGradientColorChange));

         this.opacitySlider = new Slider(0);

         this.actor = new St.BoxLayout({ vertical: false });

         this.pickerActor = new St.BoxLayout({ vertical: false });
         this.selectionActor = new St.BoxLayout({ vertical: true });
         this.colorPicker = new St.BoxLayout({ vertical: true });


         this.inspectorActor = new St.BoxLayout({ vertical: false });
         this.hintColor = new St.Bin({ reactive: true });
         this.hintColor.connect('button-release-event', Lang.bind(this, this._executePicker));

         this.hintColor.style = "min-width: 50px; border: 1px solid rgba(0,0,0,0.1); border-radius: 6px; background-color: rgba(0, 0, 0, 1.0);";
         this.inspectorActor.style = "padding: 10px 10px;";
         this.entryColor = new St.Entry({
            name: 'menu-search-entry',
            //name: 'color-chooser-entry',
            hint_text: _("Type to search..."),
            track_hover: true,
            can_focus: true
         });
         this.entryColor.width = 100;
         this.actor.add(this.pickerActor, {x_fill: true, y_fill: true, x_align: St.Align.START, y_align: St.Align.START, expand: true });
         this.actor.add(this.selectionActor);

         this.selectionActor.add(this.inspectorActor);
         global.stage.set_key_focus(this.entryColor);
         this.inspectorActor.add(this.hintColor);
         this.inspectorActor.add(this.entryColor);

         this.pickerActor.add(this.spectrum.actor);
         this.pickerActor.add(this.colorPicker, {x_fill: true, y_fill: true, x_align: St.Align.START, y_align: St.Align.START, expand: true });

         this.colorPicker.add(this.gradient.actor, {x_fill: true, y_fill: true, x_align: St.Align.START, y_align: St.Align.START, expand: true });
         this.colorPicker.add(this.opacitySlider.actor);

         this.setSize(500, 300);
      } catch (e) {
         Main.notify("Err2 " + e.message);
      }
   },

   _executePicker: function() {
      let dropper = new EyeDropper(this, Lang.bind(this, this._onPickerColor));
   },

   _onPickerColor: function(color) {
      this.setCurrentColor(color);
   },

   setSize: function(width, height) {
      this.actor.set_size(width, height);
   },

   setCurrentColor: function(color) {
      this.entryColor.set_text(color.to_string());
      //this.hintColor.set_background_color(color);
      this.hintColor.style = "min-width: 50px; border: 1px solid rgba(0,0,0,0.1); border-radius: 6px; background-color: rgba(" + 
         color.red + "," + color.green + "," + color.blue + "," + color.alpha + ");";
   },

   _onSpectrumColorChange: function(spectrum, color) {
      this.gradient.setValue(color);
   },

   _onGradientColorChange: function(gradient, color) {
      this.setCurrentColor(color);
      this.emit('color-change', color);
   },

   destroy: function() {
      this.spectrum.destroy();
      this.gradient.destroy();
      this.actor.destroy();
   }
};
Signals.addSignalMethods(ColorChooser.prototype);

function Slider() {
   this._init.apply(this, arguments);
}

Slider.prototype = {

   _init: function(value, vertical) {
      this.actor = new St.Bin({ x_fill: true, y_fill: true, x_align: St.Align.START, reactive: true });
      this.actor.connect('key-press-event', Lang.bind(this, this._onKeyPressEvent));

      this._value = null;
      this.setValue(value);

      this.vertical = (vertical == true);

      this._slider = new St.DrawingArea({ style_class: 'popup-slider-menu-item', reactive: true });
      this._slider.style = "min-width: 16px; min-height: 16px;";
      this._slider.set_size(-1, -1);
      this.actor.set_child(this._slider);
      this._slider.connect('repaint', Lang.bind(this, this._onActorRepaint));
      this.actor.connect('button-press-event', Lang.bind(this, this._startDragging));
      this.actor.connect('scroll-event', Lang.bind(this, this._onScrollEvent));

      this._releaseId = this._motionId = 0;
      this._dragging = false;
   },

   setValue: function(value) {
      let repaint = this._value != null;
      if (isNaN(value))
          value = 0;
      this._value = Math.max(Math.min(value, 1), 0);
      if(repaint)
          this._slider.queue_repaint();
   },

   _onActorRepaint: function(area) {
      let cr = area.get_context();
      let themeNode = area.get_theme_node();
      let [width, height] = area.get_surface_size();

      let handleRadius = themeNode.get_length('-slider-handle-radius');
      let sliderHeight = themeNode.get_length('-slider-height');
      let sliderBorderWidth = themeNode.get_length('-slider-border-width');
      let sliderBorderColor = themeNode.get_color('-slider-border-color');
      let sliderColor = themeNode.get_color('-slider-background-color');
      let sliderActiveBorderColor = themeNode.get_color('-slider-active-border-color');
      let sliderActiveColor = themeNode.get_color('-slider-active-background-color');

      let sliderBorderRadius, handleX, handleY, startX, startY, endX, endY, deltaX, deltaY, angle;
      if(this.vertical) {
         sliderBorderRadius = Math.min(height, sliderHeight) / 2;
         handleY = handleRadius + (height - 2 * handleRadius) * this._value;
         handleX = width / 2;
         startX = handleX;
         startY = sliderBorderRadius + sliderBorderWidth;
         endX = startX;
         endY = height - startY;
         deltaX = 0;
         deltaY = sliderBorderRadius;
         angle = Math.PI;
      } else {
         sliderBorderRadius = Math.min(width, sliderHeight) / 2;
         handleX = handleRadius + (width - 2 * handleRadius) * this._value;
         handleY = height / 2;
         startX = sliderBorderRadius + sliderBorderWidth;
         startY = handleY;
         endX = width - startX;
         endY = startY;
         deltaX = sliderBorderRadius;
         deltaY = 0;
         angle = Math.PI/2;
      }  

      cr.arc(startX, startY, sliderBorderRadius, angle, angle + Math.PI);
      cr.arc(handleX - deltaX, handleY - deltaY, sliderBorderRadius, angle + Math.PI, angle);
      Clutter.cairo_set_source_color(cr, sliderActiveColor);
      cr.fillPreserve();
      Clutter.cairo_set_source_color(cr, sliderActiveBorderColor);
      cr.setLineWidth(sliderBorderWidth);
      cr.stroke();

      cr.arc(endX, endY, sliderBorderRadius, angle + Math.PI, angle);
      cr.arc(handleX - deltaX, handleY - deltaY, sliderBorderRadius, angle, angle + Math.PI);
      Clutter.cairo_set_source_color(cr, sliderColor);
      cr.fillPreserve();
      Clutter.cairo_set_source_color(cr, sliderBorderColor);
      cr.setLineWidth(sliderBorderWidth);
      cr.stroke();

      let color = themeNode.get_foreground_color();
      Clutter.cairo_set_source_color(cr, color);
      cr.arc(handleX, handleY, handleRadius, 0, 2 * Math.PI);
      cr.fill();

      cr.$dispose();
   },

   _startDragging: function(actor, event) {
      if (this._dragging) // don't allow two drags at the same time
         return;

      this.emit('drag-begin');
      this._dragging = true;

      // FIXME: we should only grab the specific device that originated
      // the event, but for some weird reason events are still delivered
      // outside the slider if using clutter_grab_pointer_for_device
      Clutter.grab_pointer(this._slider);
      this._releaseId = this._slider.connect('button-release-event', Lang.bind(this, this._endDragging));
      this._motionId = this._slider.connect('motion-event', Lang.bind(this, this._motionEvent));
      let absX, absY;
      [absX, absY] = event.get_coords();
      this._moveHandle(absX, absY);
   },

   _endDragging: function() {
      if (this._dragging) {
         this._slider.disconnect(this._releaseId);
         this._slider.disconnect(this._motionId);

         Clutter.ungrab_pointer();
         this._dragging = false;

         this.emit('drag-end');
      }
      return true;
   },

   _onScrollEvent: function(actor, event) {
      let direction = event.get_scroll_direction();

      if (direction == Clutter.ScrollDirection.DOWN) {
         this._value = Math.max(0, this._value - SLIDER_SCROLL_STEP);
      }
      else if (direction == Clutter.ScrollDirection.UP) {
         this._value = Math.min(1, this._value + SLIDER_SCROLL_STEP);
      }

      this._slider.queue_repaint();
      this._reportChange();
   },

   _reportChange: function() {
      this.emit('value-changed', this._value);
   },

   _motionEvent: function(actor, event) {
      let absX, absY;
      [absX, absY] = event.get_coords();
      this._moveHandle(absX, absY);
      return true;
   },

   _moveHandle: function(absX, absY) {
      let relX, relY, sliderX, sliderY;
      [sliderX, sliderY] = this._slider.get_transformed_position();
      relX = absX - sliderX;
      relY = absY - sliderY;

      let handleRadius = this._slider.get_theme_node().get_length('-slider-handle-radius');

      let newvalue;
      if(this.vertical) {
         let height = this._slider.height;
         if (relY < handleRadius)
            newvalue = 0;
         else if (relY > height - handleRadius)
            newvalue = 1;
         else
            newvalue = (relY - handleRadius) / (height - 2 * handleRadius);
      } else {
         let width = this._slider.width;
         if (relX < handleRadius)
            newvalue = 0;
         else if (relX > width - handleRadius)
            newvalue = 1;
         else
            newvalue = (relX - handleRadius) / (width - 2 * handleRadius);
      }
      this._value = newvalue;
      this._slider.queue_repaint();
      this._reportChange();
   },

   get value() {
      return this._value;
   },

   _onKeyPressEvent: function(actor, event) {
      let key = event.get_key_symbol();
      if (key == Clutter.KEY_Right || key == Clutter.KEY_Left) {
         let delta = key == Clutter.KEY_Right ? 0.1 : -0.1;
         this._value = Math.max(0, Math.min(this._value + delta, 1));
         this._slider.queue_repaint();
         this._reportChange();
         this.emit('drag-end');
         return true;
      }
      return false;
   }
};
Signals.addSignalMethods(Slider.prototype);

function Scale() {
   this._init.apply(this, arguments);
}

Scale.prototype = {
   __proto__: Slider.prototype,

   _init: function(value, vertical) {
      Slider.prototype._init.call(this, value, vertical);
      this._slider.style = "min-width: 20px; min-height: 20px;";
   },

   _onActorRepaint: function(area) {
      let cr = area.get_context();
      let themeNode = area.get_theme_node();
      let [width, height] = area.get_surface_size();

      let handleRadius = themeNode.get_length('-slider-handle-radius');
      let sliderHeight = themeNode.get_length('-slider-height');
      let sliderBorderWidth = themeNode.get_length('-slider-border-width');
      let sliderBorderColor = themeNode.get_color('-slider-border-color');
      let sliderColor = themeNode.get_color('-slider-background-color');
      let sliderActiveBorderColor = themeNode.get_color('-slider-active-border-color');
      let sliderActiveColor = themeNode.get_color('-slider-active-background-color');

      let sliderBorderRadius, handleX, handleY, startX, startY, endX, endY, deltaX, deltaY, angle;
      if(this.vertical) {
         sliderBorderRadius = Math.min(height, sliderHeight) / 2;
         handleY = handleRadius + (height - 2 * handleRadius) * this._value;
         handleX = width / 2;
         startX = handleX;
         startY = sliderBorderRadius + sliderBorderWidth;
         endX = startX;
         endY = height - startY;
         deltaX = 0;
         deltaY = sliderBorderRadius;
         angle = Math.PI;

         cr.arc(startX, startY, sliderBorderRadius, angle, angle + Math.PI);
         cr.arc(endX, endY, sliderBorderRadius, angle + Math.PI, angle);

         Clutter.cairo_set_source_color(cr, sliderColor);
         cr.fillPreserve();
         Clutter.cairo_set_source_color(cr, sliderBorderColor);
         cr.setLineWidth(sliderBorderWidth);
         cr.stroke();

         let color = themeNode.get_foreground_color();
         Clutter.cairo_set_source_color(cr, color);

         cr.lineTo(handleX, handleY + sliderBorderRadius + sliderHeight);
         cr.lineTo(handleX + sliderBorderRadius + sliderHeight, handleY);
         cr.lineTo(handleX, handleY - sliderBorderRadius - sliderHeight);
         cr.lineTo(handleX - sliderHeight, handleY - sliderBorderRadius - sliderHeight);
         cr.lineTo(handleX - sliderHeight, handleY + sliderBorderRadius + sliderHeight);
         cr.fill();
      } else {
         sliderBorderRadius = Math.min(width, sliderHeight) / 2;
         handleX = handleRadius + (width - 2 * handleRadius) * this._value;
         handleY = height / 2;
         startX = sliderBorderRadius + sliderBorderWidth;
         startY = handleY;
         endX = width - startX;
         endY = startY;
         deltaX = sliderBorderRadius;
         deltaY = 0;
         angle = Math.PI/2;

         cr.arc(startX, startY, sliderBorderRadius, angle, angle + Math.PI);
         cr.arc(endX, endY, sliderBorderRadius, angle + Math.PI, angle);

         Clutter.cairo_set_source_color(cr, sliderColor);
         cr.fillPreserve();
         Clutter.cairo_set_source_color(cr, sliderBorderColor);
         cr.setLineWidth(sliderBorderWidth);
         cr.stroke();

         let color = themeNode.get_foreground_color();
         Clutter.cairo_set_source_color(cr, color);

         cr.lineTo(handleX - sliderBorderRadius - sliderHeight, handleY);
         cr.lineTo(handleX, handleY - sliderBorderRadius - sliderHeight);
         cr.lineTo(handleX + sliderBorderRadius + sliderHeight, handleY);
         cr.lineTo(handleX + sliderBorderRadius + sliderHeight, handleY + sliderHeight);
         cr.lineTo(handleX - sliderBorderRadius - sliderHeight, handleY + sliderHeight);
         cr.fill();
      }
      cr.$dispose();
   }
};

function ScaleSpectrum() {
   this._init.apply(this, arguments);
}

ScaleSpectrum.prototype = {
   __proto__: Scale.prototype,

   _init: function(initColor, sequence, style_class) {
      Scale.prototype._init.call(this, 0, true);

      this._scale = this.actor;
      if (!style_class)
         style_class = '';
      this.actor = new Cinnamon.GenericContainer({ style_class: style_class, reactive: true });
      this.actor._delegate = this;
      this._motionId = 0;
      this._container = new St.Bin({ x_fill: true, y_fill: true, x_align: St.Align.START });
      this._container.style = "min-width: 20px; min-height: 200px;";
      this._data = new Array(4*(sequence.length*255 + 1));
      this._imageActor = this._getSpectrumImage();
      this._generateSpectrum(initColor, sequence);
      this._container.set_child(this._imageActor);
      this._imageActor.set_reactive(true);

      this.actor.add_actor(this._container);
      this.actor.add_actor(this._scale);

      this.actor.connect('get-preferred-width', Lang.bind(this, this._getPreferredWidth));
      this.actor.connect('get-preferred-height', Lang.bind(this, this._getPreferredHeight));
      this.actor.connect('allocate', Lang.bind(this, this._allocate));
      this.actor.connect('button-press-event', Lang.bind(this, this._onButtonPressEvent));
      this.actor.connect('button-release-event', Lang.bind(this, this._onButtonReleaseEvent));
   },

   _reportChange: function() {
      let colorPos = 4*parseInt(this._value*this._data.length/4);
      if(colorPos > this._data.length - 4)
         colorPos = this._data.length - 4;
      let color = Clutter.Color.new(this._data[colorPos], this._data[colorPos + 1], this._data[colorPos + 2], 255);
      this.emit('value-changed', color);
      this.emit('color-change', color);
      //Scale.prototype._reportChange.call(this);
   },

   _getSpectrumImage: function() {
      let coverImage = new Clutter.Image();
      let imageActor = new Clutter.Actor();
      imageActor.set_content_scaling_filters(
         Clutter.ScalingFilter.TRILINEAR,
         Clutter.ScalingFilter.LINEAR);
      imageActor.set_content(coverImage);
      return imageActor;
   },

   setValue: function(color) {
      let repaint = this._value != null;
      if (isNaN(color))
         color = Clutter.Color.new(this._data[0], this._data[1], this._data[2], 255);
      this._value = this._findValueForColor(color);
      if(repaint) {
         this._slider.queue_repaint();
         //this.emit('color-change', color);
      }
   },

   _findValueForColor: function(color) {
      //color = Clutter.Color.new(this._data[0], this._data[1], this._data[2], 255);
      return 0;
   },

   _disconnectMotionEvent: function() {
      if(this._motionId > 0) {
         this._imageActor.disconnect(this._motionId);
         this._motionId = 0;
      }
   },

   setSize: function(width, height) {
      this.actor.set_size(width, height);
   },

   _generateSpectrum: function(initColor, sequence) {
      let pos; let sign = 0; let index = 0;
      let color = [initColor.red, initColor.green, initColor.blue];
      let maxValue = this._data.length/4;
      let selected = Math.abs(sequence[index]) - 1;
      for (let x = 0; x < maxValue; x++) {
         if(index <= sequence.length) {
            pos = 4 * x;
            color[selected] += sign;
            if(x % 255 == 0) {
               selected = Math.abs(sequence[index]) - 1;
               sign = (sequence[index] > 0) ? 1 : -1;
               index++;
            }
            this._data[pos + 0] = color[0]; //red
            this._data[pos + 1] = color[1]; //green;
            this._data[pos + 2] = color[2]; //blue;
            this._data[pos + 3] = 255;//255 - x;//opacity
         } else {
            Main.notify("Es: " + x + " de " + maxValue + " " + index)
            break;
         }
      }
      let pixelFormat = Cogl.PixelFormat.RGBA_8888;// Cogl.PixelFormat.RGB_888;
      let rowstride = 4;
      this._imageActor.content.set_data(this._data, pixelFormat, 1, maxValue, rowstride);
      //let pixbuf = GdkPixbuf.Pixbuf.new_from_data(this._data, GdkPixbuf.Colorspace.RGB, true, 8, 1, maxValue, rowstride, null);
      //this._imageActor.content.set_data(pixbuf.get_pixels(), pixelFormat, 1, maxValue, rowstride);
   },

   _onMotionEvent: function() {
      let [mX, mY, mask] = global.get_pointer();
      let [aX, aY] = this.actor.get_transformed_position();
      let [aW, aH] = this.actor.get_transformed_size();
      let pos = mY - aY;
      if(pos >= 0) {
         let colorPos = pos/aH;
         if(colorPos > 1)
             colorPos = 1;
         this._value = colorPos;
         this._reportChange();
      } else
        Main.notify("my: " + mY + " ay: " + aY);
   },

   _getPreferredWidth: function(actor, forHeight, alloc) {
      let [cMin, cNatural] = this._container.get_preferred_width(-1);
      let [sMin, sNatural] = this._scale.get_preferred_width(-1);
      let width = cNatural + sNatural;
      alloc.min_size = alloc.natural_size = width;
   },

   _getPreferredHeight: function(actor, forWidth, alloc) {
      let [cChildMin, cChildWidth] = this._container.get_preferred_width(-1);
      let [cMin, cNatural] = this._container.get_preferred_height(cChildWidth);
      let [sChildMin, sChildWidth] = this._scale.get_preferred_width(-1);
      let [sMin, sNatural] = this._scale.get_preferred_height(sChildWidth);
      let height = cNatural + sNatural;
      alloc.min_size = alloc.natural_size = height;
   },

   _onButtonPressEvent: function(actor, event) {
      if(this._motionId == 0)
         this._motionId = this._imageActor.connect('motion-event', Lang.bind(this, this._onMotionEvent));
      return true;
   },

   _onButtonReleaseEvent: function(actor, event) {
      this._disconnectMotionEvent();
      return true;
   },

   _allocate: function(actor, box, flags) {
      let themeNode = this._slider.get_theme_node();
      let sliderHeight = themeNode.get_length('-slider-height') + 2;

      let cChildBox = new Clutter.ActorBox();
      let sChildBox = new Clutter.ActorBox();
      let maxHeight = Math.max(box.y2, box.y1 + this._scale.height, box.y1 + this._container.height);
      sChildBox.x1 = box.x1;
      sChildBox.x2 = box.x1 + this._scale.width;
      sChildBox.y1 = box.y1;
      sChildBox.y2 = maxHeight;
      cChildBox.x1 = sChildBox.x2 - this._scale.width/2 + 4;
      cChildBox.x2 = sChildBox.x2 + this._container.width;
      cChildBox.y1 = box.y1 + sliderHeight;
      cChildBox.y2 = maxHeight - sliderHeight;
      this._container.allocate(cChildBox, flags);
      this._scale.allocate(sChildBox, flags);
   },

   destroy: function() {
      this.actor.destroy();
      this.emit('destroy');
   }
};
Signals.addSignalMethods(ScaleSpectrum.prototype);

function GradientSelector() {
   this._init.apply(this, arguments);
}

GradientSelector.prototype = {

   _init: function(color, style_class) {
      this._container = new St.Bin({ x_fill: true, y_fill: true, x_align: St.Align.START });
      //this._container.style = "padding: 10px 10px; min-width: 200px; min-height: 200px;";
      this._cursor = new CursorColor(16);   

      this._targetX = 0;
      this._targetY = 0;
      this._currentBox = null;
      this._currentFlags = null;
      this._dragging = false;
      this._motionId = 0;
      this._releaseId = 0;

      if (!style_class)
         style_class = '';
      this.actor = new Cinnamon.GenericContainer({ style_class: style_class, reactive: true });
      this.actor.style = "padding: 10px 10px; min-width: 200px; min-height: 200px;"
      this.actor._delegate = this;
      this._data = new Array(4*256*256);
      this._imageActor = this._getGradientImage();
      this._container.set_child(this._imageActor);
      this._imageActor.set_reactive(true);
      this.setValue(color);

      this.actor.add_actor(this._container);
      this.actor.add_actor(this._cursor.actor);

      this.actor.connect('get-preferred-width', Lang.bind(this, this._getPreferredWidth));
      this.actor.connect('get-preferred-height', Lang.bind(this, this._getPreferredHeight));
      this.actor.connect('allocate', Lang.bind(this, this._allocate));
      this.actor.connect('button-press-event', Lang.bind(this, this._onButtonPressEvent));
   },

   _getGradientImage: function() {
      let coverImage = new Clutter.Image();
      let imageActor = new Clutter.Actor();
      imageActor.set_content_scaling_filters(
         Clutter.ScalingFilter.TRILINEAR,
         Clutter.ScalingFilter.LINEAR);
      imageActor.set_content(coverImage);
      return imageActor;
   },

   setValue: function(color) {
      if((!this.color)||(this.color.to_string() != color.to_string())) {
         let red, green, blue, pos;
         for (let y = 0; y < 256; y++) {
            redY = color.red + y - y*color.red/255;
            blueY = color.blue + y - y*color.blue/255;
            greenY = color.green + y - y*color.green/255;
            if(redY > 255) redY = 255;
            if(greenY > 255) greenY = 255;
            if(blueY > 255) blueY = 255;
            for (let x = 0; x < 256; x++) {
               pos = 4 *(256 * y + x);
               red = redY - x*redY/255;
               blue = blueY - x*blueY/255;
               green = greenY - x*greenY/255;
               if(red < 0) red = 0;
               if(green < 0) green = 0;
               if(blue < 0) blue = 0;
               this._data[pos + 0] = red;//red
               this._data[pos + 1] = green;
               this._data[pos + 2] = blue;//blue
               this._data[pos + 3] = 255;//255 - x;//opacity
            }
         }
         this.color = color;
         this._imageActor.content.set_data(this._data, Cogl.PixelFormat.RGBA_8888, 256, 256, 1024);
      }
   },

   _findValueForColor: function(color) {
      //color = Clutter.Color.new(this._data[0], this._data[1], this._data[2], 255);
      return 0;
   },

   setSize: function(width, height) {
      this.actor.set_size(width, height);
   },

   _getColorAtPos: function(posX, posY) {
      let [aW, aH] = this._container.get_transformed_size();
      let colorPosX = parseInt((posX*256)/(aW));
      let colorPosY = parseInt((posY*256)/(aH));
      let colorPos = 4 *(256 * colorPosY + colorPosX);
      let color = Clutter.Color.new(this._data[colorPos], this._data[colorPos + 1], this._data[colorPos + 2], 255);
      return color;
   },

   _getPreferredWidth: function(actor, forHeight, alloc) {
      let [min, natural] = this._container.get_preferred_width(-1);
      alloc.min_size = alloc.natural_size = natural;
   },

   _getPreferredHeight: function(actor, forWidth, alloc) {
      let [childMin, childWidth] = this._container.get_preferred_width(-1);
      let [min, natural] = this._container.get_preferred_height(childWidth);
      alloc.min_size = alloc.natural_size = natural;
   },

   _onButtonPressEvent: function(actor, event) {
      if (this._dragging) // don't allow two drags at the same time
         return;

      this.emit('drag-begin');
      this._dragging = true;

      // FIXME: we should only grab the specific device that originated
      // the event, but for some weird reason events are still delivered
      // outside the slider if using clutter_grab_pointer_for_device
      Clutter.grab_pointer(this._imageActor);
      this._releaseId = this._imageActor.connect('button-release-event', Lang.bind(this, this._onButtonReleaseEvent));
      this._motionId = this._imageActor.connect('motion-event', Lang.bind(this, this._motionEvent));
      let [absX, absY] = event.get_coords();
      this._moveHandle(absX, absY);
   },

   _onButtonReleaseEvent: function(actor, event) {
      if (this._dragging) {
         this._imageActor.disconnect(this._releaseId);
         this._imageActor.disconnect(this._motionId);

         Clutter.ungrab_pointer();
         this._dragging = false;

         this.emit('drag-end');
      }
      return true;
   },

   _motionEvent: function(actor, event) {
      let absX, absY;
      [absX, absY] = event.get_coords();
      this._moveHandle(absX, absY);
      return true;
   },

   _moveHandle: function(mX, mY) {
      let [aX, aY] = this._container.get_transformed_position();
      let [aW, aH] = this._container.get_transformed_size();
      let posX = mX - aX;
      let posY = mY - aY;
      if((posX < 0)||(posX >= aW)||(posY < 0)||(posY >= aH)) {
         if(posX < 0) posX = 0;
         if(posY < 0) posY = 0;
         if(posX >= aW) posX = aW - 1;
         if(posY >= aH) posY = aH - 1;
      }
      this._targetX = posX;
      this._targetY = posY;
      let color = this._getColorAtPos(posX, posY);
      this._cursor.setColor(color);
      this.actor.queue_relayout();
      this.emit('color-change', color);
   },

   _allocate: function(actor, box, flags) {
      this._container.allocate(box, flags);
      this._currentBox = box;
      this._currentFlags = flags;
      let [minWidth, minHeight, naturalWidth, naturalHeight] = this._cursor.actor.get_preferred_size();
      let childBox = new Clutter.ActorBox();
      childBox.x1 = this._currentBox.x1 + this._targetX - naturalWidth/2;
      childBox.x2 = childBox.x1 + naturalWidth;
      childBox.y1 = this._currentBox.y1 + this._targetY - naturalHeight/2;
      childBox.y2 = childBox.y1 + naturalHeight;
      this._cursor.actor.allocate(childBox, this._currentFlags);
   },

   destroy: function() {
      this.actor.destroy();
      this.emit('destroy');
   }
};
Signals.addSignalMethods(GradientSelector.prototype);

function CursorColor() {
   this._init.apply(this, arguments);
}

CursorColor.prototype = {
   _init: function(size, color, forScreen) {
      this.actor = new St.DrawingArea({ style_class: 'popup-slider-menu-item', reactive: true });
      this.actor.style = "min-width: " + size +"px; min-height: " + size + "px;";
      this.actor.set_size(size, size);
      this.actor.connect('repaint', Lang.bind(this, this._onCursorRepaint));
      this._color = color;
      let [resW, blackColor] = Clutter.Color.from_string("#000000");
      let [resB, whiteColor] = Clutter.Color.from_string("#FFFFFF");
      this._whiteColor = whiteColor;
      this._blackColor = blackColor;
      if(!this._color) {
         this._color = whiteColor;
      }
      let [cursorColor, borderColor] = this._getCursorColors(this._color);
      this._cursorColor = cursorColor;
      this._borderColor = borderColor;
      this.allocId = 0;
      this.setForScreen(forScreen);
   },

   getColor: function() {
      return this._color;
   },

   show: function() {
      this.actor.show();
   },

   hide: function() {
      this.actor.hide();
   },

   setColor: function(color) {
      if(this._color.to_string() != color.to_string()) {
         this._color = color;
         this._updateCursorColor();
      }
   },

   setForScreen: function(forScreen) {
      if(forScreen) {
         if(this.allocId == 0)
            this.allocId = this.actor.connect('allocation_changed', Lang.bind(this, this._onAllocationChanged));
      } else {
         if(this.allocId > 0) {
            this.actor.disconnect(this.allocId);
            this.allocId = 0;
         }
      }
   },

   isForScreen: function() {
      return (this.allocId != 0);
   },

   setSize: function(size) {
      this.actor.set_size(size, size);
   },

   getSize: function() {
      return Math.min(this.actor.width, this.actor.height);
   },

   getColorForScreen: function() {
      let [mX, mY, mask] = global.get_pointer();
      let size = this.getSize();
      let window = Gdk.Screen.get_default().get_root_window();
      let pixbuf = Gdk.pixbuf_get_from_window(window, mX + size/2, mY + size/2, 1, 1);
      let data = pixbuf.get_pixels();
      return Clutter.Color.new(data[0], data[1], data[2], 255);
   },
   
   _getCursorColors: function(color) {
      let sum = (color.red + color.green + color.blue);
      if(sum > 534)
         return [this._whiteColor, this._blackColor];
      return [this._blackColor, this._whiteColor];
   },

   _updateCursorColor: function() {
      let [cursorColor, borderColor] = this._getCursorColors(this._color);
      this._cursorColor = cursorColor;
      this._borderColor = borderColor;
      this.actor.queue_repaint();
   },

   _onAllocationChanged: function() {
      let color = this.getColorForScreen();
      if(this._color.to_string() != color.to_string()) {
         this._color = color;
         this._updateCursorColor();
      }
   },

   _onCursorRepaint: function(area) {
      let cr = area.get_context();
      let themeNode = area.get_theme_node();
      let [width, height] = area.get_surface_size();
      let size = Math.min(width, height);
      let middle = size/2;
      let radius = 3;
        
      cr.setLineWidth(3);
      Clutter.cairo_set_source_color(cr, this._cursorColor);
      cr.lineTo(middle, 0);
      cr.lineTo(middle, middle - radius);
      cr.stroke();
      cr.lineTo(middle, size);
      cr.lineTo(middle, middle + radius);
      cr.stroke();
      cr.lineTo(0, middle);
      cr.lineTo(middle - radius, middle);
      cr.stroke();
      cr.lineTo(size, middle);
      cr.lineTo(middle + radius, middle);
      cr.stroke();


      cr.setLineWidth(2);
      Clutter.cairo_set_source_color(cr, this._borderColor);
      cr.lineTo(middle, 0);
      cr.lineTo(middle, middle - radius);
      cr.stroke();
      cr.lineTo(middle, size);
      cr.lineTo(middle, middle + radius);
      cr.stroke();
      cr.lineTo(0, middle);
      cr.lineTo(middle - radius, middle);
      cr.stroke();
      cr.lineTo(size, middle);
      cr.lineTo(middle + radius, middle);
      cr.stroke();

      cr.setLineWidth(2);
      cr.arc(middle, middle, radius + 1, 0, 2 * Math.PI);
      cr.stroke();

      cr.setLineWidth(radius);
      Clutter.cairo_set_source_color(cr, this._color);
      cr.arc(middle, middle, 1, 0, 2 * Math.PI);
      cr.stroke();

      cr.$dispose();
      return true;
   },

   destroy: function() {
      this.actor.destroy();
   }
};
Signals.addSignalMethods(CursorColor.prototype);

function EyeDropper() {
   this._init.apply(this, arguments);
}

EyeDropper.prototype = {
   _init: function(colorChooser, callback) {
      try {
         this.menu = this._findTopMenu(colorChooser);
         this._realSourceContains = null;
         this._callback = callback;
         let [res, selectedColor] = Clutter.Color.from_string("#FFFFFF");
         this._cursor = new CursorColor(16, selectedColor, true);
         this._xfixesCursor = Cinnamon.XFixesCursor.get_for_stage(global.stage);
         this.stageEventIds = new Array();
         this.stageEventIds.push(global.stage.connect("captured-event", Lang.bind(this, this.onStageEvent)));
         this.stageEventIds.push(global.stage.connect("enter-event", Lang.bind(this, this.onStageEvent)));
         this.stageEventIds.push(global.stage.connect("leave-event", Lang.bind(this, this.onStageEvent)));

         this.actor = new St.Group({ visible: false, x: 0, y: 0 });
         Main.uiGroup.add_actor(this.actor);
         global.focus_manager.add_group(this.actor);

         let constraint = new Clutter.BindConstraint({ source: global.stage,
                                                       coordinate: Clutter.BindCoordinate.POSITION | Clutter.BindCoordinate.SIZE });
         this.actor.add_constraint(constraint);
         this.actor.add_actor(this._cursor.actor);

         Mainloop.idle_add(Lang.bind(this, this.show));
      } catch(e) {
         Main.notify("Error:", e.message);
         global.logError(e);
      }
   },

   show: function() {
      if((this.menu) && (this.menu.sourceActor)) {
         this._realSourceContains = this.menu.sourceActor.contains;
         this.menu.sourceActor.contains = function() { return true; }
         DND.currentDraggable = global.stage.key_focus;
      }
      global.set_stage_input_mode(Cinnamon.StageInputMode.FULLSCREEN);
      this._xfixesCursor.hide();
      this.actor.show();
   },

   _findTopMenu: function(colorChooser) {
      let actor = colorChooser.actor.get_parent();
      while(actor != null) {
         if((actor.get_parent() == Main.uiGroup))
            return actor._delegate;
         actor = actor.get_parent();
      }
      return null;
   },

   _moveHandle: function(mX, mY) {
      this._cursor.actor.x = mX;
      this._cursor.actor.y = mY;
      this._cursor.actor.queue_relayout();
   },
    
   onStageEvent: function(actor, event) {
      try {
         if(event.type) {
            let type = event.type();
            if((type == Clutter.EventType.KEY_PRESS) || (type == Clutter.EventType.KEY_RELEASE)) {
               if(event.get_key_symbol() == Clutter.Escape) {
                  this._pickedColor();
                  return true;
               }
               return false;
            }
            if(type == Clutter.EventType.BUTTON_RELEASE) {
               this._pickedColor();
               return true;
            }
            if(type == Clutter.EventType.MOTION) {
               let [absX, absY] = event.get_coords();
               this._moveHandle(absX, absY);
            }
         }
         return true;
      } catch(e) {
         Main.notify("Error:", e.message);
         global.logError(e);
      }

      return true;
   },

   _pickedColor: function() {
      let color = this._cursor.getColorForScreen();
      this._callback(color);
      this.emit("picked-color", color);
      this.destroy();
   },

   destroy: function() {
      for(let i = 0; i < this.stageEventIds.length; i++)
         global.stage.disconnect(this.stageEventIds[i]);
      global.focus_manager.remove_group(this.actor);
      Main.uiGroup.remove_actor(this.actor);
      this.actor.destroy();

      global.set_stage_input_mode(Cinnamon.StageInputMode.NORMAL);
      if((this.menu) && (this.menu.sourceActor)) {
         global.stage.set_key_focus(this.menu.actor);
         this.menu.sourceActor.contains = this._realSourceContains;
         DND.currentDraggable = null;
         global.set_stage_input_mode(Cinnamon.StageInputMode.FULLSCREEN);
      }
      this._xfixesCursor.show();
      this.emit("destroy");
   }
};
Signals.addSignalMethods(EyeDropper.prototype);
