/*-----------------------------------------------------------------------------
| Copyright (c) 2014-2015, S. Chris Colbert
|
| Distributed under the terms of the BSD 3-Clause License.
|
| The full license is in the file LICENSE, distributed with this software.
|----------------------------------------------------------------------------*/
module phosphor.widgets {

import Signal = core.Signal;
import connect = core.connect;
import emit = core.emit;

import Pair = utility.Pair;


/**
 * The class name added to tab panel instances.
 */
var TAB_PANEL_CLASS = 'p-TabPanel';


/**
 * A widget which can be added to a TabPanel.
 */
export
interface ITabWidget extends Widget {
  /**
   * The tab associated with the widget.
   */
  tab: Tab;
}


/**
 * A panel which provides a tabbed container for child widgets.
 *
 * The TabPanel provides a convenient combination of a TabBar and a
 * StackedPanel which allows the user to toggle between widgets by
 * selecting the tab associated with a widget.
 */
export
class TabPanel extends Widget {
  /**
   * A signal emitted when the current widget is changed.
   */
  static currentChanged = new Signal<TabPanel, Pair<number, Widget>>();

  /**
   * Construct a new tab panel.
   */
  constructor() {
    super();
    this.addClass(TAB_PANEL_CLASS);
    this.layout = new BoxLayout(Direction.TopToBottom, 0);
    this.setFlag(WidgetFlag.DisallowLayoutChange);

    var bar = this._tabBar = new TabBar();
    connect(bar, TabBar.tabMoved, this, this._p_tabMoved);
    connect(bar, TabBar.currentChanged, this, this._p_currentChanged);
    connect(bar, TabBar.tabCloseRequested, this, this._p_tabCloseRequested);

    var stack = this._stackedPanel = new StackedPanel();
    connect(stack, StackedPanel.widgetRemoved, this, this._p_widgetRemoved);

    (<BoxLayout>this.layout).addWidget(bar);
    (<BoxLayout>this.layout).addWidget(stack);
  }

  /**
   * Dispose of the resources held by the panel.
   */
  dispose(): void {
    this._tabBar = null;
    this._stackedPanel = null;
    super.dispose();
  }

  /**
   * Get the index of the currently selected widget.
   */
  get currentIndex(): number {
    return this._stackedPanel.currentIndex;
  }

  /**
   * Set the index of the currently selected widget.
   */
  set currentIndex(index: number) {
    this._tabBar.currentIndex = index;
  }

  /**
   * Get the currently selected widget.
   */
  get currentWidget(): Widget {
    return this._stackedPanel.currentWidget;
  }

  /**
   * Set the currently selected widget.
   */
  set currentWidget(widget: Widget) {
    this._tabBar.currentIndex = this.indexOf(widget);
  }

  /**
   * Get whether the tabs are movable by the user.
   */
  get tabsMovable(): boolean {
    return this._tabBar.tabsMovable;
  }

  /**
   * Set whether the tabs are movable by the user.
   */
  set tabsMovable(movable: boolean) {
    this._tabBar.tabsMovable = movable;
  }

  /**
   * Get the tab bar used by the panel.
   */
  get tabBar(): TabBar {
    return this._tabBar;
  }

  /**
   * Get the number of widgets in the panel.
   */
  get count(): number {
    return this._stackedPanel.count;
  }

  /**
   * Get the index of the given widget.
   */
  indexOf(widget: Widget): number {
    return this._stackedPanel.indexOf(widget);
  }

  /**
   * Get the widget at the given index.
   *
   * Returns `undefined` if there is no widget at the given index.
   */
  widgetAt(index: number): Widget {
    return this._stackedPanel.widgetAt(index);
  }

  /**
   * Add a tabbable widget to the end of the panel.
   *
   * If the widget already exists in the panel, it will be moved.
   *
   * Returns the index of the added widget.
   */
  addWidget(widget: ITabWidget, alignment?: Alignment): number {
    return this.insertWidget(this.count, widget, alignment);
  }

  /**
   * Insert a tabbable widget into the panel at the given index.
   *
   * If the widget already exists in the panel, it will be moved.
   *
   * Returns the index of the added widget.
   */
  insertWidget(index: number, widget: ITabWidget, alignment?: Alignment): number {
    index = this._stackedPanel.insertWidget(index, widget, alignment);
    return this._tabBar.insertTab(index, widget.tab);
  }

  /**
   * Move a widget from one index to another.
   *
   * Returns the new index of the widget.
   */
  moveWidget(fromIndex: number, toIndex: number): number {
    return this._tabBar.moveTab(fromIndex, toIndex);
  }

  /**
   * Handle the `tabMoved` signal from the tab bar.
   */
  private _p_tabMoved(sender: TabBar, args: Pair<number, number>): void {
    this._stackedPanel.moveWidget(args.first, args.second);
  }

  /**
   * Handle the `currentChanged` signal from the tab bar.
   */
  private _p_currentChanged(sender: TabBar, args: Pair<number, Tab>): void {
    this._stackedPanel.currentIndex = args.first;
    var widget = this._stackedPanel.currentWidget;
    emit(this, TabPanel.currentChanged, new Pair(args.first, widget));
  }

  /**
   * Handle the `tabCloseRequested` signal from the tab bar.
   */
  private _p_tabCloseRequested(sender: TabBar, args: Pair<number, Tab>): void {
    this._stackedPanel.widgetAt(args.first).close();
  }

  /**
   * Handle the `widgetRemoved` signal from the stacked panel.
   */
  private _p_widgetRemoved(sender: StackedPanel, args: Pair<number, Widget>): void {
    this._tabBar.removeAt(args.first);
  }

  private _tabBar: TabBar;
  private _stackedPanel: StackedPanel;
}

} // module phosphor.widgets
