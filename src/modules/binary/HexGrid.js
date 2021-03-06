define([
  "dojo/_base/declare"
  , "dgrid/OnDemandGrid"
  , "dojo/store/util/QueryResults"
  , "dojo/dom-construct"
  , "dgrid/extensions/DijitRegistry"
  , "dojo/_base/lang"
  , "dojo/_base/array"
  , "dojo/dom-class"
  , "dgrid/Keyboard"
  , "dojo/Deferred"
  , "dojo/dom-attr"
  , "sol/array/memberSort"
  , "dojo/on"
  , "sol/wgt/KeyboardInput"
], function(
  declare
  , OnDemandGrid
  , QueryResults
  , domConstruct
  , DijitRegistry
  , lang
  , array
  , domClass
  , Keyboard
  , Deferred
  , domAttr
  , memberSort
  , on
  , KeyboardInput
){
  return declare([OnDemandGrid, Keyboard, DijitRegistry], {
    "class": "hexgrid"
    
    , showHeader: false
    , cellNavigation: false
    
    , cleanUpWidgets: []
    
    , isLeftToRight: function(){
      return true;
    }
    
    , _getByteCode: function(letters){
      byteCode = "";
      byteCode += letters.letter[0].innerHTML;
      byteCode += letters.letter[1].innerHTML;
      if (byteCode == ".."){
        return 0;
      }else{
        letters.exists = true;
        return parseInt("0x" + byteCode.replace(".", "0"), 16);
      };
    }
    
    , _makeSaveLine: function(line){
      var newData = [];
      var len = 0;
      for(var i = 0; i < 16; ++i){
        //newData[i]
        newData[i] = this._getByteCode(line.letters[i]);
        if (line.letters[i].exists){
          len = i + 1;
        };
      };
      if (len < 16){
        newData.splice(len, 16);
      };
      return {
        lineNr: line.lineNr
        , data: newData
      };
    }
    
    , getSaveData: function(){
      var lines = [];
      for (var l in this.store.edited){
        var newLine = this._makeSaveLine(this.store.edited[l]);
        this.store.edited[l].data = newLine.data;
        lines.push(newLine);
      };
      memberSort(lines, "lineNr");
      return lines;
    }
    
    , resetEdited: function(){
      var removeFun = function(parSpan){
        domClass.remove(parSpan, "edited");
      };
      for (var l in this.store.edited){
        var line = this.store.edited[l];
        array.forEach(line.spans, removeFun);
        array.forEach(line.chars, removeFun);
      };
      this.store.edited = {};
    }
    
    , _makeChar: function(byteInt){
      var charStr = String.fromCharCode(byteInt);
            if (byteInt < 32 || byteInt > 254){
              charStr = ".";
            };
      return charStr;
    }
    
    , constructor: function(){
      var self = this;
      this.columns = [
      {
        label: "Line"
        , field: "lineNr"
        , sortable: false
        , width: 100
        , formatter: function(value){
          var of = value * 16;
          return of.toString(16);
        }
      }, {
        label:"Binary"
        , field: "data"
        , sortable: false
        , renderCell: function(object, value, node, options){
          
          var div = domConstruct.create("div", {
            "class": "hexLine"
          });
          
          if (self.store.edited[object.lineNr]){
            object = self.store.edited[object.lineNr];
            value = object.data;
          };
          
          var i;
          if (object.spans){
            for (i = 0; i < 16; ++i){
              domConstruct.place(object.spans[i], div);
            };
            domConstruct.place(object.chararray, div);
            return div;
          };
          
          var spans = [];
          var letters = [];
          var chars = [];
          for (i = 0; i < 16; ++i){
            var byteInt = value[i];
            var index = i;
            var byteCode;
            var charStr = self._makeChar(byteInt);
            
            var charSpan = domConstruct.create("span", {
              "class": "char char" + index
              , innerHTML: charStr
            });
            chars.push(charSpan);
            if (index < value.length){
              byteCode = byteInt.toString(16);
            }else{
              byteCode = "..";
            };
            byteCode = byteCode.toUpperCase();
            while (byteCode.length < 2){
              byteCode = "0" + byteCode;
            };
            spans[index] = domConstruct.create("span", {
              "class": "byte byte" + index
            });
            letters[index] = {
              letter: [domConstruct.create("span", {
                "class": "letter letter0"
                , innerHTML: byteCode.substr(0, 1)
              }), domConstruct.create("span", {
                "class": "letter letter1"
                , innerHTML: byteCode.substr(1, 1)
              })]
            };
            domConstruct.place(letters[index].letter[0], spans[index]);
            domConstruct.place(letters[index].letter[1], spans[index]);
            domConstruct.place(spans[index], div);
          };
          var chararray = domConstruct.create("span", {
            "class": "chararray"
          });
          for (i = 0; i < 16; ++i){
            domConstruct.place(chars[i], chararray);
          };
          domConstruct.place(chararray, div);
          object.chararray = chararray;
          object.chars = chars;
          object.spans = spans;
          object.letters = letters;
          return div;
        }
      }
      ];
      
      this.store = {
        last: 100
        , edited: {
        }
        , registerAsEdited: function(par){
          this.edited[par.lineNr] = par;
        }
        , getIdentity: function(par){
          return par.lineNr;
        },
		query: lang.hitch(this, function(query, options){
          var start = options.start || 0;
          var last = start + options.count;
          if (last > this.store.last){
            this.store.last = last;
          };
          /*var linesPs = this.parent.readLinesPs(this.fileId, options);
          var def = new Deferred();
          linesPs.then(function(lines){
            var res = [];
            for (var i = 0; i < lines.length; ++i){
              res.push({
                data: lines[i]
              });
            };
            def.resolve(res);
            return
            def.resolve(array.map(lines, function(line){
              return {
                data: line
              };
            }));
          });*/
          var ps = this.parent.readLinesPs(this.fileId, options);
          ps.total = this.store.last + 100;
          return QueryResults(ps);
		})
      };
      this.keyMap = lang.mixin(Keyboard.defaultKeyMap, {
        37: lang.hitch(this, "_left"), // left
        39: lang.hitch(this, "_right") // right
      });
      
      // hex key map
      this.keyChars = [0,1,2,3,4,5,6,7,8,9,"A","B","C","D","E","F"];
      var offset0 = 48;      // 0 key = 48
      var offsetA = 65 - 10; // a key = 65
      var i = 0;
      while(i < 10){
        this.keyMap[i + offset0] = lang.hitch(this, "_keypressed", i);
        ++i;
      };
      while(i < 16){
        this.keyMap[i + offsetA] = lang.hitch(this, "_keypressed", i);
        ++i;
      };
    }
    , "_keypressed": function(parNr){
      if (this.focused == "hex"){
        var row = this.row(this._focusedNode);
        if (row && row.data){
          this.store.registerAsEdited(row.data);
          domAttr.set(row.data.letters[this.activeHexColumn].letter[this.letterFocus], "innerHTML", this.keyChars[parNr]);
          domClass.add(row.data.spans[this.activeHexColumn], "edited");
          domClass.add(row.data.chars[this.activeHexColumn], "edited");
          var code = this._getByteCode(row.data.letters[this.activeHexColumn]);
          var charStr = this._makeChar(code);
          domAttr.set(row.data.chars[this.activeHexColumn], "innerHTML", charStr);
          this._right();
          this.parent.set("dirty", true);
        };
      };
    }
    , _input: function(c, e){
      if (this.focused == "char"){
        if (!c.length){
          return;
        };
        
        var row = this.row(this._focusedNode);
        if (row && row.data){
          this.store.registerAsEdited(row.data);
          var charStr = this._makeChar(e.charOrCode);
          domAttr.set(row.data.chars[this.activeHexColumn], "innerHTML", charStr);
          domClass.add(row.data.chars[this.activeHexColumn], "edited");
          domClass.add(row.data.spans[this.activeHexColumn], "edited");
          
          var byteInt = e.charOrCode;
          var byteStr = byteInt.toString(16);
          domAttr.set(row.data.letters[this.activeHexColumn].letter[0], "innerHTML", byteStr.substr(0, 1));
          domAttr.set(row.data.letters[this.activeHexColumn].letter[1], "innerHTML", byteStr.substr(1, 1));
          this._right();
          this.parent.set("dirty", true);
        };
      };
    }
    
    , buildRendering: function(){
      this.inherited(arguments);
      domClass.add(this.domNode, "hexgrid");
      this.on(".hexLine:click", lang.hitch(this, "hexClick"));
      this.activateHexColumn(0);
      on(this.contentNode, "keydown", function(event){
				if(event.metaKey || event.altKey || event.ctrlKey) {
					return;
				};
        var s = String.fromCharCode(event.keyCode);
        console.log(s);
				
			});
      var refocus = lang.hitch(this, function(parFun){
        return lang.hitch(this, function(){
          parFun.apply(this, arguments);
          this.keyboardInput.focus();
        });
      });
      this.keyboardInput = new KeyboardInput({
        onLEFT_ARROW: refocus(lang.hitch(this, "_left"))
        , onRIGHT_ARROW: refocus(lang.hitch(this, "_right"))
        , onUP_ARROW: refocus(lang.hitch(this, "_moveVert", -1))
        , onDOWN_ARROW: refocus(lang.hitch(this, "_moveVert", 1))
        , onInput: refocus(lang.hitch(this, "_input"))
      });
      this.keyboardInput.placeAt(this.domNode);
    }
    
    , destroy: function(){
      this.keyboardInput.destroy();
      this.inherited(arguments);
    }
    
    
    , "removeRow": function(rowElement){
      // destroy our widget during the row removal operation
      array.forEach(this.cleanUpWidgets, function(parColId){
        var cellElement = this.cell(rowElement, parColId).element;
        var widget = (cellElement.contents || cellElement).widget;
        if(widget){ 
          widget.destroy(); 
        };
      }, this);
      if (rowElement.widget){
        rowElement.widget.destroy();
      };
      this.inherited(arguments);
    }
    
    , activateHexColumn: function(parColumnNr){
      domClass.remove(this.domNode, "activeByte" + this.activeHexColumn);
      this.activeHexColumn = parColumnNr;
      domClass.add(this.domNode, "activeByte" + this.activeHexColumn);
    }
    
    
    , _activateByte: function(parSpan){
      for(var i = 0; i < 16; ++i){
        if (domClass.contains(parSpan, "byte" + i)){
          this.activateHexColumn(i);
          return;
        };
      };
    }
    
    , _activateLetter: function(parSpan){
      if (domClass.contains(parSpan, "letter0")){
        this.activateLetter(0);
        return;
      };
      if (domClass.contains(parSpan, "letter1")){
        this.activateLetter(1);
        return;
      };
    }
    
    , _activateChar: function(parSpan){
      for(var i = 0; i < 16; ++i){
        if (domClass.contains(parSpan, "char" + i)){
          this.activateHexColumn(i);
          return;
        };
      };
    }
    
    , _setFocused: function(parFocus){
      this._set("focused", parFocus);
      if (parFocus == "hex"){
        domClass.add(this.domNode, "hexEditMode");
        domClass.remove(this.domNode, "charEditMode");
      };
      if (parFocus == "char"){
        domClass.remove(this.domNode, "hexEditMode");
        domClass.add(this.domNode, "charEditMode");
        this.keyboardInput.focus();
      };
    }
    
    , hexClick: function(evt){
      if (!evt.target){
        return;
      };
      if (domClass.contains(evt.target, "byte")){
        this.set("focused", "hex");
        this._activateByte(evt.target);
        return;
      };
      if (domClass.contains(evt.target.parentNode, "byte")){
        this.set("focused", "hex");
        this._activateByte(evt.target.parentNode);
        if (domClass.contains(evt.target, "letter")){
          this._activateLetter(evt.target);
        };
        return;
      };
      if (domClass.contains(evt.target, "char")){
        this.set("focused", "char");
        this._activateChar(evt.target);
      };
    }
    
    
    , _moveVert: function(steps){
      next = this.down(this._focusedNode, steps, true);
      
      this._focusOnNode(next, false);
    }
    
    , activateLetter: function(parNr){
      this.letterFocus = parNr;
      if (parNr == 1){
        domClass.add(this.domNode, "activeLetter1");
        domClass.remove(this.domNode, "activeLetter0");
      };
      if (parNr === 0){
        domClass.add(this.domNode, "activeLetter0");
        domClass.remove(this.domNode, "activeLetter1");
      };
    }
    
    , moveLetterFocus: function(parDir){
      if (this.letterFocus == 1){
        this.activateLetter(0);
      }else{
        this.activateLetter(1);
      };
      if (parDir > 0){
        if (this.letterFocus === 0){
          return true;
        };
      };
      if (parDir < 0){
        if (this.letterFocus === 1){
          return true;
        };
      };
    }
    
    , _left: function(){
      if (this.focused == "hex"){
        if (this.moveLetterFocus(-1)){
          if (this.activeHexColumn === 0){
            this.activateHexColumn(15);
            this._moveVert(-1);
            return;
          };
          this.activateHexColumn(this.activeHexColumn - 1);
        };
      };
      if (this.focused == "char"){
          if (this.activeHexColumn === 0){
            this.activateHexColumn(15);
            this._moveVert(-1);
            return;
          };
          this.activateHexColumn(this.activeHexColumn - 1);
      };
    }
    , _right: function(){
      if (this.focused == "hex"){
        if (this.moveLetterFocus(1)){
          if (this.activeHexColumn == 15){
            this.activateHexColumn(0);
            this._moveVert(1);
            return;
          };
          this.activateHexColumn(this.activeHexColumn + 1);
        };
      };
      if (this.focused == "char"){
          if (this.activeHexColumn === 15){
            this.activateHexColumn(0);
            this._moveVert(1);
            return;
          };
          this.activateHexColumn(this.activeHexColumn + 1);
      };
    }

    
  });
});