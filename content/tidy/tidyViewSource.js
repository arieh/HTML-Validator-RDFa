//*************************************************************************
// HTML Validator
//
//  File: tidyBrowser.js
//  Description: javascript to validate the HTML in the view source window
//  Author : Marc Gueury
//  Licence : see licence.txt
//*************************************************************************

//-------------------------------------------------------------
// Public functions
//-------------------------------------------------------------

var oTidyViewSource;

function onLoadTidyViewSource()
{
  onLoadTidyUtil();
  oTidyViewSource = new TidyViewSource();
  oTidyViewSource.start();
  
  // Hide the validator here to avoid a "splash" effect  
  if( !oTidyUtil.getBoolPref("viewsource_enable") )
  {
    if( oTidyUtil.getBoolPref("viewsource_enable_once") )
    {
      oTidyUtil.setBoolPref( "viewsource_enable_once", false );
    }
    else
    {
      oTidyViewSource.hideValidator( true );
    }
  }
  
  // Call the original function of the View Source dialog.
  onLoadViewSource();
    
  // Register the onLoad trigger, when the page is loaded -> validate
  getBrowser().addEventListener("load", tidyValidateHtml, true);

}

function onUnloadTidyViewSource() 
{
  onUnloadTidyUtil();
  oTidyViewSource.stop();
  delete oTidyViewSource;
  oTidyViewSource = null;
}

function tidyValidateHtml( event )
{
  var doc = event.originalTarget;
  if( doc.URL.substring(0,12) == "view-source:" )
  {
    var box = document.getElementById("tidy-view_source-box");
    var value = !box.hidden;
    if( 
     (   window._content.document.contentType == "text/html"
      || window._content.document.contentType == "application/xhtml+xml"
     ) 
     && !box.hidden
    )
    {
      oTidyViewSource.validateHtmlFromNode();
    }
    else
    {
      oTidyViewSource.hideValidator( true );
    }

    oTidyViewSource.addLineNumber( true );
  }
}

function tidyOptions()
{
  openDialog(
             "chrome://tidy/content/tidyOptions.xul",
             "",
             "centerscreen,dialog=no,chrome,resizable,dependent,modal"
            );
  // rebuild the filter array            
  oTidyUtil.buildFilterArray();            
  // remove the color from the lines
  oTidyViewSource.removeColorFromLines();
  oTidyViewSource.addLineNumber( false );
  // revalidate with the new options            
  oTidyViewSource.validateHtmlFromNode();      
}

function tidyCleanup()
{
  var sHtml = oTidyViewSource.getHtmlFromNode(); 
  oTidyUtil.cleanupDialog( oTidyViewSource.tidyResult, sHtml, window.arguments );
}

function tidyHtmlPedia()
{
  var sHtml = oTidyViewSource.getHtmlFromNode(); 
  var help = oTidyViewSource.currentHelpPage.substring(0,oTidyViewSource.currentHelpPage.lastIndexOf('.'));
  var url = "http://www.htmlpedia.org/wiki/"+help;
  openNewWindowWith(url, null, false);
}

function tidyOnline()
{
  var sHtml = oTidyViewSource.getHtmlFromNode(); 
  oTidyUtil.onlineHtmlValidate( sHtml );
}

function tidyHideValidator()
{
  var box = document.getElementById("tidy-view_source-box");
  oTidyViewSource.hideValidator( !box.hidden );
}

function tidyViewSourceLoadExplainError()
{
  oTidyUtil.selectionOn( document.getElementById("tidy-explain-error") );
}

function tidySelectAll()
{
}

//-------------------------------------------------------------
// TidyViewSource
//-------------------------------------------------------------

function TidyViewSource()
{
  this.aRow = new Array(); //Data for each row
  this.atoms= new Array(); //Atoms for tree's styles  
}

TidyViewSource.prototype =
{
  // xul elements
  xulTree: null,
  xulMenuHide: null,
  xulMenuShowLineNumber: null,
  xulScrollBar: null,
  xulExplainError: null,

  // Tidy initialized or not yet
  bIsValidated: false,
  iLastErrorId: -1,
  tidyResult: null,
  currentHelpPage: "",  
  
  // Style
  STYLE_NORMAL  : 1,
  STYLE_RED     : 2,
  STYLE_SUMMARY : 3,

  // Tree interface
  rows: 0,          // number of rows of the tree
  tree: null,       // tree interface
  
  // Horizontal scrolling
  hScrollPos: 0,
  hScrollMax: 0,
  datapresent: "datapresent",
  bLineNumberAdded : false,
  
  /** __ treeView ________________________________________________________________
   * 
   * Implementation of all needed function for the tree interface
   */    
  set rowCount(c) { throw "rowCount is a readonly property"; },
  get rowCount() { return this.rows; },
  getCellText: function(row, col) 
  {
    var id = (col.id?col.id:col); // Compatibility Firefox 1.0.x
    if( id=="col_line" ) 
    {
      line = this.aRow[row].line;
      return line>0?line:"";
    }
    else if( id=="col_column" ) 
    {
      column = this.aRow[row].column;
      return column>0?column:"";
    }
    else if( id=="col_icon" ) 
    {
      return " "+this.aRow[row].icon_text;
    }
    else if( id=="col_data" ) 
    {
      return this.aRow[row].data.substr(this.hScrollPos).match(/^.*/);
    }
    return null;
  },
  setCellText: function(row, column, text) {},
  setTree: function(tree) { this.tree = tree; },
  isContainer: function(index) { return false; },
  isSeparator: function(index) { return false; }, 
  isSorted: function() {},
  getLevel: function(index) { return 0; },
  getImageSrc: function(row, col)
  {
    var id = (col.id?col.id:col);
    if( id=="col_icon" && this.aRow[row].icon!=null ) 
    {      
      return "chrome://tidy/skin/"+this.aRow[row].icon+".png";
    } 
    else 
    {
      return null;
    }
  },
  getCellProperties: function(row, col, props) 
  {
    if( this.aRow[row].type==4 ) // error
    {
      // XXXXXXXXXXXXXXXXXX
      // props.AppendElement(this.atoms[this.STYLE_RED]);
    }
    else if( this.aRow[row].type==10 ) // summary
    {
      props.AppendElement(this.atoms[this.STYLE_SUMMARY]);
    }
  },
  getColumnProperties: function(column, elem, prop) {}, 
  getRowProperties: function(row, props) { },

  isContainerOpen: function(index) { },
  isContainerEmpty: function(index) { return false; },
  canDropOn: function(index) { return false; },
  canDropBeforeAfter: function(index, before) { return false; },
  drop: function(row, orientation) { return false; },
  getParentIndex: function(index) { return 0; },
  hasNextSibling: function(index, after) { return false; },
  getProgressMode: function(row, column) { },
  getCellValue: function(row, column) { },
  toggleOpenState: function(index) { },
  cycleHeader: function(col, elem) 
  { 
    var id = (col.id?col.id:col); // Compatibility Firefox 1.0.x
    id = id.substring(4);
    if( id=="icon" ) id = "icon_text";
    
    if(!elem) 
    {
      elem=col.element;
    }
    
    var descending = elem.getAttribute("sortDirection")=="ascending";
    elem.setAttribute( "sortDirection", descending?"descending":"ascending" );
    oTidyUtil.sortArray( this.aRow, id, descending );
    this.tree.invalidate();
  },
  selectionChanged: function() { },
  cycleCell: function(row, column) { },
  isEditable: function(row, column) { return false; },
  performAction: function(action) { },
  performActionOnRow: function(action, row) { },
  performActionOnCell: function(action, row, column) { },

  /** __ addRow ________________________________________________________________
   * 
   * Tree utility function : add a row
   */    
  addRow: function( _row ) 
  { 
    // Add the row
    this.rows = this.aRow.push( _row );
    if( _row.data.length>this.hScrollMax)
    {
      this.sethScroll(_row.data.length);
    }
  }, 
  
  /** __ rowCountChanged ______________________________________________________
   * 
   * Tree utility function : notice the tree that the row count is changed
   */    
  rowCountChanged: function(index, count)
  {
    if( this.tree )
    {
      var lvr = this.tree.getLastVisibleRow();
      this.tree.rowCountChanged(index, count);
      // If the last line of the tree is visible on screen, we will autoscroll
      // if (lvr >= index) this.tree.ensureRowIsVisible(this.rows-1);
    }
  },

  /** __ sethScroll ___________________________________________________________
   * 
   * Horizontal scrolling function
   */
  sethScroll: function(max) 
  {
    // Set the new maximum value and page increment to be 5 steps
    var maxpos = this.xulScrollBar.attributes.getNamedItem("maxpos");
    var pageincrement=this.xulScrollBar.attributes.getNamedItem("pageincrement");
    maxpos.value = (max>2 ? max-3 : 0);
    pageincrement.value = max/5;
    this.hScrollMax = max;
  },
  
  /** __ hScrollHandler _____________________________________________________
   * 
   * Horizontal scrolling function : call back function
   */
  hScrollHandler: function() 
  {
    var base = oTidyViewSource;
    var curpos = base.xulScrollBar.attributes.getNamedItem("curpos").value;
    if (curpos != base.hScrollPos) 
    {
      base.hScrollPos = curpos;
      base.tree.invalidate();
    }
  },
  
  /** __ start ________________________________________________________________
   * 
   * Initialisation and termination functions
   */    
  start : function()
  {
    // Tree
    this.xulTree = document.getElementById("tidy-view_source-tree");
    this.xulTree.treeBoxObject.view = this;

    // Set scrollbar
    this.xulScrollBar = document.getElementById("tidy-view_source-tree-scroll");
    setInterval(this.hScrollHandler,100);

    // Set explain error HTML
    this.xulExplainError = document.getElementById("tidy-explain-error");
    this.xulExplainError.addEventListener("load", tidyViewSourceLoadExplainError, true);

    // Enable the selection in the explain-error (Firefox 1.0 only)
    // Firefox 1.4 raise an exception but it works out of the box
    try
    {
      var selCon = this.xulExplainError.docShell
         .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
         .getInterface(Components.interfaces.nsISelectionDisplay)
         .QueryInterface(nsISelectionController);
      selCon.setDisplaySelection(nsISelectionController.SELECTION_ON);
      selCon.setCaretEnabled(true);
      selCon.setCaretVisibilityDuringSelection(true);
    }
    catch(ex)
    {
    }
       
    // Tree Style (called Atoms)
    var aserv=Components.classes["@mozilla.org/atom-service;1"].
               createInstance(Components.interfaces.nsIAtomService);
    this.atoms[this.STYLE_NORMAL]  = aserv.getAtom("StyleNormal");
    this.atoms[this.STYLE_RED]     = aserv.getAtom("StyleRed");
    this.atoms[this.STYLE_SUMMARY] = aserv.getAtom("StyleSummary");
    
    // Menu 
    this.xulMenuHide = document.getElementById('tidy.hide');
    this.xulMenuHide.setAttribute("checked", "false");

    // Menu 
    this.xulMenuShowLineNumber = document.getElementById('tidy.show_line_number');
    this.xulMenuShowLineNumber.setAttribute("checked", oTidyUtil.getBoolPref("show_line_number") );
        
  },
  
  stop : function()
  {
    this.xulTree.treeBoxObject.view = null;
    this.xulTree = null;
    this.xulScrollBar = null;
  },  
  
  /** __ clear ________________________________________________________________
   * 
   * Clear the tree
   */    
  clear : function()
  {
    var oldrows = this.rows;
    if( oldrows>0 )
    {
      this.xulTree.view.selection.clearSelection();
      this.rows = 0;
      this.aRow = new Array();
      this.rowCountChanged(0,-oldrows);
      this.hScrollMax = 0;
      this.sethScroll(0);
    }
  },  
      
  /** __ validateHtml ________________________________________________________
   * 
   * Validate the HTML and add the results in the tree
   */    
  validateHtml : function( aHtml )
  {
    var unsorted = -1;
    var row;
    // Set the initialization flag
    this.bIsValidated = true;
    
    // Load the translation (if not done)
    oTidyUtil.translation();
    
    // Show in the menu that the validator is enabled
    this.xulMenuHide.setAttribute("checked", "true");
    
    // Validate
    var res = new TidyResult();
    var error = res.validate( aHtml );
  
    this.clear();
    var oldrows = this.rowCount;
    
    // Show an error if the mime/type is not text/html or xhtml
    if( window._content.document.contentType != "text/html" 
     && window._content.document.contentType != "application/xhtml+xml" )
    {
      row = new TidyResultRow();
      row.init(oTidyUtil.getString("tidy_not_html")+" "+window._content.document.contentType, 0, 0, 4, unsorted--, null, null, null, "error", "Error");
      this.addRow( row ); 
    }
    // Show the number of errors/warnings
    row = new TidyResultRow();
    row.init( res.getErrorString(), 0, 0, 10, unsorted--, null, null, null, res.getIcon(), "Result");
    this.addRow( row ); 

    var rows = error.value.split('\n');
    var colorLines = new Array();
    var nbColorLines = 0;
    for (var o in rows) 
    {
      row = new TidyResultRow();
      row.parse( res.algorithm, rows[o], unsorted );
      
      if( (res.algorithm=="tidy" && row.type==0) )
      {
        row.errorId = unsorted--; 
      }
      if( !row.skip ) 
      {
        this.addRow( row ); 
      }
      if( row.line>0 )
      {
        if( !colorLines[row.line] ) nbColorLines ++;     
        colorLines[row.line] = true;
      }  
    }      
    // save the value for the cleanup button
    this.tidyResult = res;

    this.rowCountChanged(oldrows,(this.rows-oldrows)); 
    
    if( oTidyUtil.getBoolPref( "highlight_line" ) && nbColorLines<=oTidyUtil.getIntPref("highlight_max"))
    {  
      this.colorizeLines( colorLines );
    }
    // Load start page
    if( res.iNbError==0 && res.iNbWarning==0 )
    {
      this.loadHelp(res.algorithm+"_good.html");
    }
    else
    {
      this.loadHelp(res.algorithm+"_start.html");    
    }
    
    // Enable or not the "Hide..." function of the error message
    /*var xulHide = document.getElementById("tidy-view_source-tree-hide");
    xulHide.hidden = !res.isMessageHidable();*/
  },  
  
  /** __ onSelect ____________________________________________________
   * 
   * Select function
   */   
  onSelect: function()
  {
    var selection = this.xulTree.view.selection;

    // A warning/error line is something like : 'line 10 column 20 ...'
    var row = selection.currentIndex;
    if( row<0 || row>=this.rows ) return;
    
    var d = this.aRow[row].data;

    // No line is selected ?
    if( !d ) return;

    var src = this.tidyResult.algorithm+"_start.html"
    var line = this.aRow[row].line;
    var col = this.aRow[row].column;

    if( line>0 )
    {
      if( col<1 ) col=1;
      var arg1=this.aRow[row].arg1;
      var arg2=this.aRow[row].arg2;
      var arg3=this.aRow[row].arg3;

      // build the array of potentially selectable strings
      var aToSelect = new Array();
      if( arg1.length>0 )
      {
        aToSelect.push( arg1 );
        if( arg2.length>0 )
        {
          aToSelect.push( arg2 );
          if( arg3.length>0 )
          {
            aToSelect.push( arg3 );
          }
        }
      }
      this.goToLineCol( line, col, aToSelect );
    }

    var error_id = this.aRow[row].errorId;
    this.iLastErrorId = error_id;

    if( this.aRow[row].type==3 )
    {
      var pos1 = d.indexOf( '[' );
      var pos2 = d.indexOf( ']' );
      var access_id = d.substring( pos1+1, pos2 );    
      // alert( access_id );
      src = "access_"+access_id+".html";
    }
    else if( this.aRow[row].type==0 )
    {
      src = "info.html";
    }
    else if( error_id>0 && error_id <1200)
    {
      src = this.tidyResult.algorithm+"_"+error_id+".html";
    }
    else if (error_id >0 && error_id>1200){
      src = this.tidyResult.algorithm+"_"+error_id.substring(2)+".html";
    }
    // Enable or not the "Hide..." function of the error message
    var xulHide = document.getElementById("tidy-view_source-tree-hide");
    xulHide.hidden = !this.aRow[row].isMessageHidable();

    this.loadHelp(src);
  },

  /** __ loadHelp ____________________________________________________
   * 
   * load an help file
   */   
  loadHelp : function(src)
  {
    function helpExists(fileName)
    {
      try {
        var req = new XMLHttpRequest();
        req.open('GET', fileName, false);
        req.send(null);
      }
      catch(ex){
        return false;
      }
        return true;
    }

    if( src.length==0 ) return;
    
    var url = [
      "chrome://tidy/content/help/"+oTidyUtil.defaultLanguage+"/"+src,
      "chrome://tidy/content/help/en-US/"+src,
      "chrome://tidy/content/help/"+oTidyUtil.defaultLanguage+"/no_help.html",
      "chrome://tidy/content/help/en-US/no_help.html"
      ];

    for (var i=0; i<url.length; ++i)
    {
      if (helpExists(url[i]))
      {
        this.currentHelpPage = src;      
        this.xulExplainError.loadURI( url[i] );
        break;
      }
    }
  },      
          
     
  /** __ onTreeHide ____________________________________________________
   * 
   * Hide a message when right clicking on it
   */   
  onTreeHide : function()
  {
    if( this.iLastErrorId>0 )
    {
      // The inout arguments need to be JavaScript objects
      var aErrorDesc = {value:""};
      if( this.tidyResult.algorithm=="tidy" ) 
      {
        oTidyUtil.tidy.getErrorDescription( this.iLastErrorId, aErrorDesc );
      }
      else // SP message
      {
        aErrorDesc.value=this.aRow[this.xulTree.view.selection.currentIndex].data; 
      }

      // Show a confirmation dialog 
      var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                          .getService(Components.interfaces.nsIPromptService);
      var flags=promptService.BUTTON_TITLE_YES * promptService.BUTTON_POS_0 +
                promptService.BUTTON_TITLE_NO * promptService.BUTTON_POS_1;
      var result = promptService.confirmEx(window,oTidyUtil.getString("tidy_filter_title"),
                   oTidyUtil.getString("tidy_filter_msg") + aErrorDesc.value,
                   flags, null, null, null, null, {} );
     
      if( result==0 )
      {   
        if( this.tidyResult.algorithm=="tidy" ) 
        {
          oTidyUtil.addToFilterArray( 't'+this.iLastErrorId );
        }
        else
        {
          oTidyUtil.addToFilterArray( 's'+this.iLastErrorId );
        }
        oTidyUtil.saveFilterArrayInPref();

        // rebuild the filter array            
        oTidyUtil.buildFilterArray();
        // remove the color from the lines
        oTidyViewSource.removeColorFromLines();
        oTidyViewSource.addLineNumber( false );
        // revalidate with the new options
        oTidyViewSource.validateHtmlFromNode();
      }
    }
  },
  
  /** __ onTreeCopy ____________________________________________________
   * 
   * Copy the current error message in clipboard
   */   
  onTreeCopy : function()
  {
    var selection = this.xulTree.view.selection;
    var data = "", rStart = {}, rEnd = {};
    var ranges = selection.getRangeCount();
    for (var range=0; range<ranges; range++) 
    {
      selection.getRangeAt(range, rStart, rEnd);
      if (rStart.value >=0 && rEnd.value >=0) 
      {
        for (var row=rStart.value; row<=rEnd.value; row++) 
        {
          data += this.aRow[row].getString()+"\n";
	}
      }
    }
    if( oTidyUtil.getBoolPref( "debug" ) )
    {
      // In debug mode, show the ID and the desc of the error
      var aErrorDesc = {value:""};
      oTidyUtil.tidy.getErrorDescription( this.iLastErrorId, aErrorDesc );

      data += "ErrorId: "+this.iLastErrorId + " / Desc: " + aErrorDesc.value;
    }

    if (data) 
    {
      // clipboard helper
      try
      {
        const clipboardHelper = Components.classes["@mozilla.org/widget/clipboardhelper;1"].getService(Components.interfaces.nsIClipboardHelper);
	clipboardHelper.copyString(data);
      } 
      catch(e) 
      {
        // do nothing, later code will handle the error
	dump("Unable to get the clipboard helper\n");
      }
    }    
  },

  /** __ onTreeSelectAll ____________________________________________________
   * 
   * Select all
   */   
  onTreeSelectAll : function()
  {
    return this.xulTree.view.selection.selectAll();
  },
  
  /** __ validateHtmlFromNode ___________________________________________
   *
   * Get the HTML from the view source tree then validate it.
   */   
  validateHtmlFromNode: function()
  {
    this.validateHtml( this.getHtmlFromNode() );
  },
  

  /** __ getHtmlFromNode _________________________________________________
   *
   * Build the HTML from the text of all the source view nodes
   * This is done to avoid another network request
   */   
  getHtmlFromNode: function()
  {
    var viewsource = this.getParentPre();
    var sHtml = "";
    var pre;
    
    //
    // Walk through each of the text nodes
    //
    for (var i = 0; i < viewsource.childNodes.length; i++ ) 
    {
      pre = viewsource.childNodes[i];
      if( pre.id!="line12345678" )
      {
        var treewalker = window._content.document.createTreeWalker(pre, NodeFilter.SHOW_TEXT, null, false);  
        
        for( var textNode = treewalker.firstChild(); textNode; textNode = treewalker.nextNode()) 
        {  
          sHtml = sHtml + textNode.data;        
        }
      }
    }
   
    return sHtml;
  },  
  
  
  /** __ colorizeLines ______________________________________________________
   * 
   * Color a array of lines
   */
  colorizeLines: function( colorLines )
  {
    for (var line in colorLines) 
    {
      this.colorizeOneLine( parseInt(line) ); 
    }
  },

  /** __ colorizeOneLine ____________________________________________________
   * 
   * Color one line of the HTML source
   *
   * @param line : (number) line number
   */
  colorizeOneLine: function( line )
  {
    // This code is inspired by the goToLine of viewSource.js 
    // it is the same, except that the range is highlighted
    var viewsource = this.getParentPre();
    var pre;
    for (var lbound = 0, ubound = viewsource.childNodes.length; ; ) {
      var middle = (lbound + ubound) >> 1;
      pre = viewsource.childNodes[middle];
  
      var firstLine = parseInt(pre.id.substring(4));
  
      if (lbound == ubound - 1) {
        break;
      }
  
      if (line >= firstLine) {
        lbound = middle;
      } else {
        ubound = middle;
      }
    }
  
    var result = {};
    var found = findLocation(pre, line, null, -1, false, result);
  
    if (!found) {
      return;
    }
    
    this.colorizeRange(result.range);
  },  

  /** __ colorizeRange ____________________________________________________
   * 
   * Color a range of the HTML source
   *
   * @param range : (range) the range 
   */
  colorizeRange: function( range )  
  {
    // Bug in Firefox 3.0.9 !
    if( oTidyUtil.firefoxVersionEqual("3.0.9") ) 
    {
      return;
    }
    
    var doc = window._content.document;
    var node = doc.createElement("span");
    node.setAttribute("style", "background-color: #DDDDFF;");
    node.setAttribute("id", "__firefox-tidy-id");
  
    // This code is inspired by the highlight function of browser.js 
    var startContainer = range.startContainer;
    var startOffset = range.startOffset;
    var endOffset = range.endOffset;
    var docfrag = range.extractContents();
    var before = startContainer.splitText(startOffset);
    var parent = before.parentNode;
    node.appendChild(docfrag);
    parent.insertBefore(node, before);
    return node;
  },
  
  /** __ removeColorFromLines ___________________________________________
   * 
   * Remove the color added to the lines
   */
  removeColorFromLines: function()  
  {
    var doc = window._content.document;
    var elem = null;

    while ((elem = doc.getElementById("__firefox-tidy-id"))) 
    {
      var child = null;
      var docfrag = doc.createDocumentFragment();
      var next = elem.nextSibling;
      var parent = elem.parentNode;
      while((child = elem.firstChild)) 
      {
        docfrag.appendChild(child);
      }
      parent.removeChild(elem);
      parent.insertBefore(docfrag, next);
    }
    return;
  },
  
  /** __ getParentPre ___________________________________________________
   * 
   * Get the parent of all pre tags 
   */
  getParentPre: function()
  {
    var parent = window._content.document.getElementById('parent_pre');
    if( parent==null )
    {
      parent = window._content.document.body;
    }
    return parent;
  },
   
  /** __ goToLineCol ____________________________________________________
   * 
   * Go to the line and col in the HTML source
   *
   * @param line : (number) line
   * @param col  : (number) column
   */
  goToLineCol: function(line, col, aToSelect)
  {
    var viewsource = this.getParentPre();
  
    var pre;
    for (var lbound = 0, ubound = viewsource.childNodes.length; ; ) {
      var middle = (lbound + ubound) >> 1;
      pre = viewsource.childNodes[middle];
  
      var firstLine = parseInt(pre.id.substring(4));
  
      if (lbound == ubound - 1) {
        break;
      }
  
      if (line >= firstLine) {
        lbound = middle;
      } else {
        ubound = middle;
      }
    }
  
    var result = {};
    var found = this.getLineColRange(pre, line, col, aToSelect, result);
  
    if (!found) {
      return false;
    }
  
    var selection = window._content.getSelection();
    selection.removeAllRanges();
    selection.QueryInterface(nsISelectionPrivate)
      .interlinePosition = true;	
    selection.addRange(result.range);
    if (!selection.isCollapsed) 
    {
      selection.collapseToEnd();
  
      var offset = result.range.startOffset;
      var node = result.range.startContainer;
      if (offset < node.data.length) {
        // The same text node spans across the "\n", just focus where we were.
        selection.extend(node, offset);
      }
      else {
        // There is another tag just after the "\n", hook there. We need
        // to focus a safe point because there are edgy cases such as
        // <span>...\n</span><span>...</span> vs.
        // <span>...\n<span>...</span></span><span>...</span>
        node = node.nextSibling ? node.nextSibling : node.parentNode.nextSibling;
        selection.extend(node, 0);
      }
    }
  
    var selCon = this.getSelectionController();
    selCon.setDisplaySelection(nsISelectionController.SELECTION_ON);
    selCon.setCaretEnabled(true);
    selCon.setCaretVisibilityDuringSelection(true);
  
    // Scroll the beginning of the line into view.
    selCon.scrollSelectionIntoView(
      nsISelectionController.SELECTION_NORMAL,
      nsISelectionController.SELECTION_FOCUS_REGION,
      true);
  
    gLastLineFound = line;
  
    // needed to avoid problem in Firefox
    var statusbar = document.getElementById("statusbar-line-col");
    if( statusbar )
    {
       statusbar.label = getViewSourceBundle().getFormattedString("statusBarLineCol", [line, 1]);
    }
  
    return true;
  },

  /** __ addLineNumber ____________________________________________________
   * 
   * Add line number before the each HTML line
   */
  addLineNumber: function( bFromOnLoad )
  {
    var doc = window._content.document;
    var viewsource = doc.body;

    if( bFromOnLoad )
    {
      this.bLineNumberAdded = false;
    }
    var bShow = oTidyUtil.getBoolPref("show_line_number");
    this.xulMenuShowLineNumber.setAttribute("checked", bShow );

    if( bShow )
    {
      viewsource.className = 'line';
    }
    else if( viewsource.className != 'wrap' )
    {
      viewsource.className = '';
    }

    var menu1 = document.getElementById("menu_wrapLongLines");
    if( menu1 ) menu1.setAttribute("checked", viewsource.className == 'wrap' );
    
    // If Line number is not enabled, skip it
    // Or if the line numbers are already there, show and hide are done with CSS
    if( !bShow || this.bLineNumberAdded )
    {
      return;
    }

    // count the number of lines:
    var pre = viewsource.lastChild;
    var iNbLine = parseInt(pre.id.substring(4));
    var treewalker = window._content.document.createTreeWalker(pre, NodeFilter.SHOW_TEXT, null, false);
    var textNode=treewalker.firstChild()
    if( textNode )
    {
      for (; textNode; textNode = treewalker.nextNode() ) 
      {
        // \r is not a valid character in the DOM, so we only check for \n.
        var lineArray = textNode.data.split(/\n/);
        iNbLine  += lineArray.length - 1;
        if( lineArray.length>1 && lineArray[lineArray.length-1].length==0 )
        {
          var nextNode = treewalker.nextNode(); 
          if( nextNode==null )
            break;
          else 
            treewalker.previousNode(); 
        }
      }
      /*
      for (; textNode; textNode = treewalker.nextNode() ) 
      {
        // \r is not a valid character in the DOM, so we only check for \n.
        var lineArray = textNode.data.split(/\n/);
        if( lineArray.length>1 && lineArray[lineArray.length-1].length==0 )
        {
          var nextNode = treewalker.nextNode(); 
          if( nextNode==null )
            break;
          else 
            treewalker.previousNode(); 
        }
        iNbLine  += lineArray.length - 1;
      }
      */
    }
    else
    {
      iNbLine -= 1;
    }

    // remove the italics / bold (linux) in the stylesheet of viewsource
    var platform = tidyUtilGetPlatform();
    
    if( doc.styleSheets[0] )
    {
      var ss = doc.styleSheets[0];
      var css = ss.cssRules;
      for( var i=0; i<css.length; i++ )
      {
        if( css[i].style && css[i].style.fontStyle=='italic' )
        {
          css[i].style.fontStyle='normal';
        }
        if( /* platform!='windows' && */ css[i].style && css[i].style.fontWeight=='bold' )
        {
          css[i].style.fontWeight='';
        }        
        /*
        // set the margin of pre to 4.2em
        if( css[i].selectorText && css[i].selectorText=="pre" )
        {
          css[i].style.marginLeft = '4.2em';
        }
        */
      }
    }    
    
    // Add a new stylesheet locale to the document
    var head = doc.getElementsByTagName("head")[0];
    var style = doc.createElement('style');
    style.media = 'all';
    style.type  = 'text/css';
    head.appendChild(style);
    var sheet = style.sheet;
    sheet.insertRule('@media screen {}', 0);
    var mediaScreen = sheet.cssRules.item(0);
    mediaScreen.insertRule( 'body.wrap pre { margin: 0; }', 0 );
    mediaScreen.insertRule( 'body.wrap #line12345678 { display: none; }', 1 );
    mediaScreen.insertRule( 'body.line pre { margin-left: 4.2em; }', 2 );
    mediaScreen.insertRule( '#line12345678 { display: none; }', 3 );
    mediaScreen.insertRule( 'body.line #line12345678 { margin: 0; display: inline; }', 4 );
    sheet.insertRule('@media print {}', 1);
    var mediaPrint = sheet.cssRules.item(1);
    mediaPrint.insertRule( 'body #line12345678 { display: none; }', 0 );
    mediaPrint.insertRule( 'pre { margin: 0; }', 1 );
    
    // Create a pre element shown on the side with CSS rules
    var pre = doc.createElement("pre");
    pre.id = 'line12345678';
    pre.setAttribute("style", "position: absolute; top:8px; left:5px; right: 4em; margin: 0 2px 0 0; padding-right: 2px; border-right: 1px solid #000; text-align:right; width: 4em; color: #000; background-color: #ddd;");
    
    for( var i=1; i<=iNbLine; i++)
    {
      var t = doc.createTextNode( i );
      var br = doc.createElement("br");
      pre.appendChild(t);
      pre.appendChild(br);
    }
    doc.body.appendChild(pre);    

    this.bLineNumberAdded = true;
  },
  
  addLineNumberV6: function( bFromOnLoad )
  {
    var doc = window._content.document; 
    // Remember code block.
    var code = doc.getElementById('line1');

    // A numberd list to store code lines in.
    var list = doc.createElement('ol');

    // The first line.
    var line = doc.createElement('li');

    while (code.childNodes.length > 0) 
    {
      // Take the first node of the displayd code.
      var codeNode = code.removeChild(code.firstChild);

      // Append it to the current line.
      line.appendChild(codeNode);

      // A line break marks a new line (obviously)
      if (codeNode.nodeName == 'BR') 
      {
        // Append the finished line to the list.
        list.appendChild(line);
        // Prepare a new line.
        line = doc.createElement('li');
      }
    }
    list.appendChild(line);
    code.appendChild(list);
},
  
    
  /** __ getSelectionController _________________________________________
   *
   * This is to avoid repeatless bugs and change about this function 
   * in Firefox where it becomes tiring
   */
  getSelectionController : function()
  {
     return getBrowser().docShell
     .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
     .getInterface(Components.interfaces.nsISelectionDisplay)
     .QueryInterface(nsISelectionController);
   
  },
  
  /** __ getLineColRange ____________________________________________________
   * 
   * get the range for a line and a column 
   *
   * @param
   */
  getLineColRange : function (pre, line, col, aToSelect, result)
  {
    var curLine = parseInt(pre.id.substring(4));
  
    //
    // Walk through each of the text nodes and count newlines.
    //
    var treewalker = window._content.document
        .createTreeWalker(pre, NodeFilter.SHOW_TEXT, null, false);
  
    //
    // The column number of the first character in the current text node.
    //
    var firstCol = 1;
  
    var found = false;
    for (var textNode = treewalker.firstChild();
         textNode && !found;
         textNode = treewalker.nextNode()) 
    { 
      //
      // \r is not a valid character in the DOM, so we only check for \n.
      //
      var lineArray = textNode.data.split(/\n/);
      var lastLineInNode = curLine + lineArray.length - 1;
  
      //
      // Check if we can skip the text node without further inspection.
      //

      var nextFirstCol = firstCol;
      if (lineArray.length > 1) 
      {
        nextFirstCol = 1;
      }
      nextFirstCol += lineArray[lineArray.length - 1].length;

      if( 
          lastLineInNode < line || 
          ( lastLineInNode==line && nextFirstCol<=col )
        ) 
      {
        firstCol = nextFirstCol;
        curLine = lastLineInNode;
        continue;
      }
  
      //
      // curPos is the offset within the current text node of the first
      // character in the current line.
      //
      for (var i = 0, curPos = 0;
           i < lineArray.length;
           curPos += lineArray[i++].length + 1) 
      {
  
        if (i > 0) 
        {
          curLine++;
          firstCol = 1;
        }
  
        if (curLine == line && !("range" in result)) 
        {
          // The default behavior is to select 1 character.
          result.range = document.createRange();
          var pos = curPos+col-firstCol;         
          result.range.setStart(textNode, pos);
          result.range.setEnd(textNode, pos+1);
          found = true;  


          // Check if the text does not contain a selectable string

          // get first the maximum len of the selectable string
          var j, len, maxlen = 0;
          for( j=0; j<aToSelect.length; j++ )
          {
            len = aToSelect[j].length;
            if( len>maxlen ) maxlen = len;
          }
          
          // get the rest of the text of the node where the text starts
          var textAfter = textNode.data.substr( pos );
          
          // we will potentially look 2 node further
          for ( var n=0; n<3; n++ ) 
          {   
            // Search in the selectable string array
            for( j=0; j<aToSelect.length; j++ )
            {
              var s = aToSelect[j].toLowerCase();
              len = s.length;
              var s2 = textAfter.substr( 0, len ).toLowerCase();
              if( s==s2 )
              {
                result.range.setEnd(textNode, pos+len);              
              }
              // If it is a tag, '<TAG>', '<TAG' is also good
              else if( s.charAt(0)=='<' && s.charAt(len-1)=='>' )
              {
                s = s.substr(0,len-1);
                s2 = s2.substr(0,len-1);
                if( s==s2 )
                {
                  result.range.setEnd(textNode, pos+len-1);              
                }                          
              }
            }
            
            // If the text searched is bigger than the biggest string to search,
            // stop the search
            len = textAfter.length
            if( len>=maxlen )
            {
              break;
            }
            pos = -len;
            // Go to the next node 
            textNode = treewalker.nextNode()
            if( textNode )
            {
              // Concatenate the next node text
              textAfter += textNode.data; 
            }
            else
            {
              break;
            }
          }
        } 
      }
    }
  
    return found;
  },
  
  /** __ hideValidator ____________________________________________________
   * 
   * Hide the html validator
   *
   * @param bHide : (boolean) hide or not hide 
   */
  hideValidator : function( bHide )
  {
    var box = document.getElementById("tidy-view_source-box");
    var splitter = document.getElementById("tidy-splitter");
    box.hidden = bHide;
    splitter.hidden = bHide;
    this.xulMenuHide.setAttribute("checked", !bHide);
    
    // The validation has already been done ?
    if( !bHide && !this.bIsValidated )
    {
      oTidyViewSource.validateHtmlFromNode();
    }
    else
    {
      oTidyViewSource.loadHelp( oTidyViewSource.currentHelpPage );
    }    
  },

  /** __ showLineNumber ____________________________________________________
   * 
   * show the line number in the html validator
   * Switch between on and off
   */
  showLineNumber : function()
  {
    var viewsource = window._content.document.body;
    var bShow = true;
    if( viewsource.className=='wrap' )
    {
      viewsource.className = '';
    }
    else
    {
      bShow = !oTidyUtil.getBoolPref("show_line_number");
    }
    oTidyUtil.setBoolPref( "show_line_number", bShow );    
    this.addLineNumber( false );
  },

  /** __ selectAll ____________________________________________
  */
  selectAll : function ()
  {
    var doc = window._content.document;

    var range = doc.createRange();
    range.setStartBefore( doc.body.firstChild );
    var end = doc.body.lastChild;
    if( end.id=='line12345678' )
    {
      range.setEndAfter( end.previousSibling );
    }
    else
    {
      range.setEndAfter( end );
    }
    
    var selection = window.content.getSelection();
    selection.removeAllRanges();
    selection.QueryInterface(nsISelectionPrivate).interlinePosition = true;        
    selection.addRange(range);
    
    var selCon = this.getSelectionController();
    selCon.setDisplaySelection(nsISelectionController.SELECTION_ON);
    selCon.setCaretEnabled(true);
    selCon.setCaretVisibilityDuringSelection(true);  
  }
}

//---------------------------------------------------------------------------
// Copy from browser.js
function tidyExplainErrorOnClick(event)
{
   var target = event.target;
   var linkNode;

   var local_name = target.localName;

   if (local_name) 
   {
     local_name = local_name.toLowerCase();
   }

   switch (local_name) 
   {
     case "a":
     case "area":
     case "link":
       if (target.hasAttribute("href")) 
         linkNode = target;
       break;
     default:
       linkNode = findParentNode(event.originalTarget, "a");
       // <a> cannot be nested.  So if we find an anchor without an
       // href, there is no useful <a> around the target
       if (linkNode && !linkNode.hasAttribute("href"))
         linkNode = null;
       break;
   }
   if (linkNode && event.button == 0 ) 
   {
     openNewWindowWith(linkNode.href, linkNode, false);
     event.preventDefault();
     event.preventBubble();
     return true;
   }
   return true;
}

// Copy from viewsource.js
function wrapLongLines()
{
  var myWrap = window.content.document.body;

  if (myWrap.className != 'wrap')
    myWrap.className = 'wrap';
  else myWrap.className = '';

  if (gPrefs){
    try {
      if (myWrap.className == '') {
        gPrefs.setBoolPref("view_source.wrap_long_lines", false);
      }
      else {
        gPrefs.setBoolPref("view_source.wrap_long_lines", true);
        oTidyUtil.setBoolPref( "show_line_number", false );
        oTidyViewSource.xulMenuShowLineNumber.setAttribute("checked", false );
        if( oTidyUtil.getBoolPref("warning_line_number") )
        {
          // Show a warning the 1rst time line numbering is disabled 
          var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                              .getService(Components.interfaces.nsIPromptService);
          var result = promptService.alert( window,oTidyUtil.getString("tidy_validator"),oTidyUtil.getString("tidy_wrap_msg") );
          oTidyUtil.setBoolPref( 'warning_line_number', false );
        }
      }
    } catch (ex) {
    }
  }
}

