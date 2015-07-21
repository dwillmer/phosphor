/*-----------------------------------------------------------------------------
| Copyright (c) 2014-2015 Phosphor Contributors
|
| Distributed under the terms of the BSD 3-Clause License.
|
| The full license is in the file LICENSE, distributed with this software.
|----------------------------------------------------------------------------*/
module example {

import Component = phosphor.virtualdom.Component;
import Elem = phosphor.virtualdom.Elem;
import IData = phosphor.virtualdom.IData;
import createFactory = phosphor.virtualdom.createFactory;
import dom = phosphor.virtualdom.dom;
import render = phosphor.virtualdom.render;
import Widget = phosphor.widgets.Widget;
import ListView = phosphor.widgets.ListView;

/**
 * A console is a series of user inputs, each with
 * their own respective responses.
 * Here we store the data required to be able to
 * recreate the series from any point in time.
 *
 */
interface InputData {
  text: string;
}

interface OutputData {
  /**
   * The response can be any of:
   * "text/plain", "text/latex", "image/jpg", "image/png"
   *
   */
  type: string;
  value: string;
}

class ConsoleIOPair {
  input: InputData;
  output: OutputData;

}

interface Coords {
  x: number;
  y: number;
}

/**
 * Cursor class
 *
 */
class Cursor {
  x: number = 0;
  y: number = 0;
  width: number = 2;
  font_size_em: number = 18;

  _height: number;
  _ctx : CanvasRenderingContext2D;

  _blink_on_ms: number = 600;
  _blink_off_ms: number = 400;
  
  _interval_id: number;

  constructor( context: CanvasRenderingContext2D ) {
    this._ctx = context;
    this._setHeight();
    this._blink();
  }

  _setHeight() {
    var h = this._ctx.measureText('W').width;
    this._height = h + h/6;
  }

  setPosition( x: number, y: number ) {
    this.x = x;
    this.y = y;
    /*this._ctx.fillStyle = 'black';*/
    /*console.log( 'set position' + x + ' ' + y );*/
    /*this._ctx.fillRect( x, y, this.width, this._height );*/
  }

  _draw( fill_style: string ) {
    this._ctx.fillStyle = fill_style;
    this._ctx.fillRect( this.x, this.y, this.width, this._height );
  }

  _blink() {
    this._interval_id = setInterval( () => {
      this._draw('black');
      setTimeout( () => {
        this._draw('white');
        }, this._blink_on_ms
      );
    }, this._blink_on_ms + this._blink_off_ms );
  }
  
  clearCursor() {
    clearInterval( this._interval_id );
    this._draw('white');
  }
}

/**
 * Console class rendering on an HTML5 canvas.
 *
 * We're assuming monospaced fonts here. It's a
 * console! This allows us to just store the cursor
 * position as (line_no, char_no) in the model,
 * and have that easily translated to the actual
 * position by the view.
 *
 * Co-ordinate system has (0,0) in top-left.
 * We have a separate module with helper functions
 * to allow us to calculate the size of the text, and
 * then we apply it line-by-line using \n's as the
 * break sequence.
 * The console is only 'editable' (ie, allows you to
 * type) if you are on the last line, and there is a
 * prompt.
 * The string for the prompt is a callback, so you can
 * return different text for each line (eg, the number
 * of executions in an ipython console).
 *
 */
class ConsoleView extends Widget {

  /**
   * These should not be stored here, these should be
   * array-like, each showing an IOPair
   */
  private _cn: HTMLCanvasElement;
  private _ctx: CanvasRenderingContext2D;

  private _vpos: number = 20; // vertical position of next entry
  private _hpos: number;
  private _margin_width: number = 55;

  private _font_size: number;
  private _char_width: number;
  private _char_height: number;

  private _row_height: number;
  private _row_string: string;

  private _pairs: ConsoleIOPair[] = []; // TODO : put on data model.

  private _cursor: Cursor;
  
  private _owner: any; // TODO - type this.
  
  // TODO : find a better way of doing this
  // currently we're setting event listeners for the keydown/keypress
  // events in order to get the input.
  // In order to unset these when the row is finalised, we need a handle
  // on the exact function that was passed into addEventListener.
  // This means we can't use the usual anonymous function syntax,
  // but unfortunately just passing in this._the_function - without parens -
  // didn't work. We're storing 'anonymous' funcs here as a workaround - 
  // There *must* be a better way.
  private _key_press_func: any;
  private _key_down_func: any;

  constructor( owner: any ) {
    super();
    this._owner = owner;
    this.addClass('p-ConsoleWidget');
    this._font_size = 18;
    this._setTextAttributes( this._font_size );
    this._cn = <HTMLCanvasElement>document.createElement("canvas");
    this._cn.width = window.innerWidth-40;
    this._cn.height = 100;
    this._cn.style.border = "2px solid black";

    this._cn.onmousedown = () => { this._cnClicked(); };
    this._cn.onmousemove = () => { this._cnMouseMoved(); };
    document.body.appendChild( this._cn );

    this._ctx = this._cn.getContext( "2d" );
    this._ctx.font = "normal 18px helvetica";

    this._vpos = 20;
    this._ctx.textBaseline = "bottom";
    this._cursor = new Cursor( this._ctx );

    // default console style.
    /*this._ctx.fillStyle = 'black';
    this._ctx.fillRect( 0, 0, this._cn.width, this._cn.height );
    this._ctx.fillStyle = 'white';*/

    // TODO : text measuring library. need font height.
    /*var text = "Testing";
    this._ctx.fillText( text, 10, this._vpos );
    //var metrics = this._ctx.measureText( text );
    this._vpos += this._getTextHeight( text );*/

    this._row_string = "";
    this._key_press_func = (evt: KeyboardEvent) => { this._keyPressHandler( evt ) };
    this._key_down_func = (evt: KeyboardEvent) => { this._onKeyDownHandler( evt ) };
    window.addEventListener(
      "keypress",
      this._key_press_func,
      true
    );

    window.addEventListener(
      "keydown",
      this._key_down_func,
      true
    );

    this._cn.addEventListener(
      "mousedown",
      (evt: MouseEvent) => { this._onMouseDownHandler(evt, this._ctx) },
      true
    );

    this._inputLine( this._row_string );
  }
  
  private _removeListeners(): void {
    window.removeEventListener( "keypress", this._key_press_func, true );
    window.removeEventListener( "keydown", this._key_down_func, true );
  }
  
  /**
   * Prevent the row from being modified any further, and free any
   * resources that could cause performance degradation.
   * 
   * This involves removing all event listeners, blinking cursors etc, 
   */
  private _finaliseRow(): void {
    this._removeListeners();
    this._cursor.clearCursor();
  }

  private _onMouseDownHandler( evt: MouseEvent, ctx: any ) {
    var pos = this._windowToCanvas( evt.pageX, evt.pageY );
    console.log( pos.toString() );
  }

  private _windowToCanvas( x: number, y: number ): Coords {
    var bbox = this._cn.getBoundingClientRect();

    return {
      x: x-bbox.left * (this._cn.width / bbox.width),
      y: y-bbox.top * (this._cn.height / bbox.height)
    }
  }

  private _setTextAttributes(fontSize: number) {
    var line = document.createElement('div');
    var body = document.body;
    line.style.position = 'absolute';
    line.style.whiteSpace = 'nowrap';
    line.style.font = fontSize +'px Helvetica';
    line.style.visibility = 'hidden';
    body.appendChild(line);

    line.innerHTML = 'm';
    this._char_width = line.offsetWidth;
    console.log( line.offsetHeight );
    this._char_height = line.offsetHeight;
    this._row_height = line.offsetHeight;
  }

  private _setCursor() {
    var x_pos = this._ctx.measureText(this._row_string).width + this._margin_width;
    this._cursor.setPosition( x_pos, this._vpos-this._row_height );
  }

  private _onKeyDownHandler( event: KeyboardEvent ): string {
    var key = event.which || event.keyCode;

    switch(key)
    {
      case 8:
        console.log('Backspace pressed');
        if( this._row_string.length ) {
          this._row_string = this._row_string.substring( 0, this._row_string.length-1 );
          this._inputMargin();
          this._renderTextRow( this._row_string );
          return key.toString();
        }
      case 13:
       console.log('Enter pressed');
       this._processNewInput();
       this._finaliseRow();
       this._owner.newRowRefresh();
    }

    return key.toString();
  }

  private _keyPressHandler( event: KeyboardEvent ): string {
    var key = event.which || event.keyCode;

    this._row_string += String.fromCharCode( event.which );
    this._inputMargin();
    this._renderTextRow( this._row_string );

    return key.toString();
  }

  private _processNewInput(): ConsoleIOPair {
    var current_input = this._row_string;
    this._row_string = '';

    var pair = new ConsoleIOPair();
    pair.input = { text: current_input };
    pair.output = { type: 'image/png', value: 'test' };
    this._pairs.push( pair );
    this._renderPair( pair );
    return pair;
  }

  private _renderPair( pair: ConsoleIOPair ) {
    this._renderInput( pair.input.text );
    //this._renderOutput( pair.output );
  }

  private _renderInput( input: string ) {
    this._inputMargin();
    this._renderTextRow( input );
    this._vpos += this._row_height;
  }

  private _renderOutput( data: OutputData ): any {
    switch(data.type) {
        case 'text/plain':
          this._outputMargin();
          this._renderTextRow( data.value );
          return data.value;
        case 'image/png':
          this._outputMargin();
          this._renderImageRow( data.value );
    }
  }

  /**
   * The method for putting a string of characters, or return
   * value of text/plain on screen.
   *
   */
  private _renderTextRow( text: string ) {
    this._ctx.clearRect( this._margin_width, this._vpos-this._row_height, this._cn.width, this._row_height );
    this._ctx.fillText( text, this._margin_width, this._vpos );
    this._setCursor();
  }

  /**
   * The method for putting an image (from a bytestring) on screen.
   */
  private _renderImageRow( data: string ) {
    var image_data = "data:image/png;base64,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\ngKo6CVyY5OImhxRUcQa4Cbgn4dK255HUbYsk948C7wWe2+Px1wBPzNz+NnD0kHNpF/bv0rgk/Mqq\nP3vB/k+ctwLfq6pTSbb2Wzp3e9dTcJLcMXPzRFWdWGBG7XQc2GLSv3v+uzQwk732J34d3nY9XLry\n32Huu7kD1wI3THv1I8ArkvxFVd0ys+Y7wCUzt49O73uBqrpj1UE1UUUl3Ao8lPBgFfe1PZOkJtVZ\n4G3AY8DPw53fXeVZ9q1lqup9VXVJVV0K3Az809zGDnA/cAtAkmuAp6rq9CrDaDH279LwJBxJuJPJ\nnvph4MYqVt5LD0ru82oyRG4DqKq7q+qBJMeSfAv4IZOzOrRmVZycHgifSbiuimfanknSahKuAj7J\nJK3/0mE29eef0ytU+8vPn5H6LeEI8EEmofh24LPTU59n1niF6uh4/rvUX9O0/q/A5UzS+mfmN/ZD\nPb/Jvf/8/BmpPxZJ6zvXm9xHy/PfpX5Yd1rf8Vom92Gwf5e6a9m0vvNnTe6jZv8uddMm0/qO1zW5\nD4v9u9QNh0nrO5/H5C7s36UuaCut75jB5D489u9SO5pK6zuf0+SuKft3afO6kNZ3zGNyHy77d2n9\n1pHWdz6/yV1z7N+l9epaWp9lch84+3epeetO6ztfy+SuXdi/S83qclqfZXIfCft36XA2mdZ3vq7J\nXfuwf5dW15e0PsvkPiL279Jy2krrO2cwuesA9u/S4vqY1meZ3EfI/l3aWxfS+s55TO5akP27tLu+\np/VZJveRsn+XzulaWp9lctdS7N+liSGl9Vkm95Gzf9dYdTmtzzK5ayX27xqjoab1WSZ32b9rNPqS\n1meZ3LUy+3eNwRjS+iyTu55n/64h6mNan2Vy16HZv2toxpbWZ5nctYP9u4ag72l9lsldjbB/V9+N\nOa3PMrlrV/bv6pshpfVZJnc1yv5dfWJafyGTu/Zk/66uG2pan2VyV+Ps39VlpvX9mdx1IPt3dckY\n0vosk7vWxv5dXWFaX5zJXQuxf1ebxpbWZ5nctVb272qLaX01Jnctxf5dmzLmtD7L5K6NsH/XJpjW\nD8/krqXZv2tdTOsvZHLXxti/ax1M680yuWtl9u9qgml9fyZ3bZz9uw7LtL4+Jncdiv27VmFaX5zJ\nXa2wf9eyTOubYXJXI+zfdRDT+mpM7mqV/bv2Y1rfvAM39yRHkpxM8nCSR5PcucuarSRPJzk1/Xr/\n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\nNED/D64LHKfgo8K1AAAAAElFTkSuQmCC\n";
    var image = new Image();
    image.src = image_data;
    var implace = this._vpos;
    this._outputMargin();
    this._vpos += this._getImageHeight( image );
    image.onload = () => {
      this._ctx.drawImage( image, this._margin_width, implace );
    }

    /*this._vpos += this._getImageHeight( image );*/
  }

  /*private _renderCurrentRow(ctx: any): number {
    var margin = this._marginText();
    ctx.clearRect( 10, this._vpos-this._row_height, this._cn.width, this._row_height );
    ctx.fillText( margin + this._row_string, 10, this._vpos );
    return 10; // TODO return width.
  }*/

  /*private _marginText(): string {
    return 'In[]: '; // TODO
  }*/

  private _inputMargin() {
    this._ctx.clearRect( 0, this._vpos-this._row_height, this._margin_width, this._row_height );
    this._ctx.fillStyle = 'green';
    this._ctx.fillText( 'In[' + this._pairs.length + ']: ', 2, this._vpos );
    this._ctx.fillStyle = 'black';
  }

  private _outputMargin() {
    this._ctx.clearRect( 0, this._vpos-this._row_height, this._margin_width, this._row_height );
    this._ctx.fillStyle = 'red';
    this._ctx.fillText( 'Out[' + this._pairs.length + ']: ', 2, this._vpos );
    this._ctx.fillStyle = 'black';
  }

  private _inputLine( text: string ) {
    this._inputMargin();
    this._renderTextRow( text );
  }

  private _outputLine( text: string ) {
    this._outputMargin();
    this._renderTextRow
  }

  private _getImageHeight( image: any ): number {
    return image.height+this._row_height;
  }

  private _getTextHeight( text: string ): number {
    return this._row_height; // TODO
  }

  private _cnClicked() {} // TODO
  private _cnMouseMoved() {} // TODO
}


class ConsoleListView extends ListView {
  
  // TODO : should be on a data model.
  private the_rows: ConsoleView[] = [];
  
  constructor() {
    super();
    this.addInputRow();
  }
  
  addInputRow(): void {
    var row = new ConsoleView( this );
    var count = this.the_rows.push( row );
    this.refresh( count );
  }
  
  newRowRefresh(): void {
    this.addInputRow();
    this.refresh( this.rowCount );
  }
  
  refresh( num: number ): void {
    // blah
    
  }
  
  protected renderRow( index: number, host: HTMLElement ): void {
    var item: ConsoleView = this.the_rows[index];
    item.attach( host );
    item.fit();
    // host.appendChild( item );
  }
}


function main(): void {

  //var console = new ConsoleView();
  //console.attach( document.getElementById('main') );
  //console.fit();
  
  var console = new ConsoleListView();
  console.attach( document.getElementById('main') );
  console.fit();

}


window.onload = main;

} // module example
