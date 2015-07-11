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
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const Gtk = imports.gi.Gtk;
const Clutter = imports.gi.Clutter;
const Settings = imports.ui.settings;

const AppletPath = imports.ui.appletManager.applets['colorChooser@lestcape'];
const ColorChooser = AppletPath.colorChooser;

function MyApplet() {
    this._init.apply(this, arguments);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);
        try {
            this._uuid = metadata["uuid"];
            this.icon_path = metadata.path + '/icons/';
            Gtk.IconTheme.get_default().append_search_path(this.icon_path);
            this.set_applet_icon_name("color-chooser");
            this.set_applet_tooltip("Color Chooser");
            
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);
            let section = new PopupMenu.PopupMenuSection();
            this.menu.addMenuItem(section);
            let [res, color] = Clutter.Color.from_string("#FF0000FF");
            this.chooser = new ColorChooser.ColorChooser(color);
            section.actor.add(this.chooser.actor, {x_fill: true, y_fill: true, y_align: St.Align.START, expand: true});

            this.chooser.connect('saved-colors-changed', Lang.bind(this, this._onSavedColorsChanged));
            this.chooser.connect('color-format-changed', Lang.bind(this, this._onChooserColorFormatChanged));
            this.menu.connect('open-state-changed', Lang.bind(this, this._onOpenStateChanged));

            this.settings = new Settings.AppletSettings(this, this._uuid, this.instance_id);
            this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "saved-colors", "savedColors", null, null);
            this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "format", "format", this._onFormatChanged, null);
            this.setSavedColors();
            this._onFormatChanged();
        } catch (e) {
            global.logError(e);
        }
    },

    setSavedColors: function() {
        this.chooser.setSaveColors(this.savedColors); 
    },

    _onFormatChanged: function() {
        if(this.format == "HEXA")
           this.chooser.setFormat(ColorChooser.COLOR_FORMAT.HEXA);
        else if(this.format == "RGBA")
           this.chooser.setFormat(ColorChooser.COLOR_FORMAT.RGBA);
        else if(this.format == "HSLA")
           this.chooser.setFormat(ColorChooser.COLOR_FORMAT.HSLA);
        else if(this.format == "PIXL")
           this.chooser.setFormat(ColorChooser.COLOR_FORMAT.PIXL);
    },

    _onChooserColorFormatChanged: function(chooser, format) {
        if(format == ColorChooser.COLOR_FORMAT.HEXA)
           this.format = "HEXA";
        else if(format == ColorChooser.COLOR_FORMAT.RGBA)
           this.format = "RGBA";
        else if(format == ColorChooser.COLOR_FORMAT.HSLA)
           this.format = "HSLA";
        else if(format == ColorChooser.COLOR_FORMAT.PIXL)
           this.format = "PIXL";
    },

    _onSavedColorsChanged: function(chooser, savedColors) {
        this.savedColors = savedColors;
    },

    on_applet_clicked: function(event) {
        this.menu.toggle();
    },

   _onOpenStateChanged: function(menu, open) {
      if(open) {
         this.chooser.setFocusKeyFocus();
      }
   }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(metadata, orientation, panel_height, instance_id);
}
