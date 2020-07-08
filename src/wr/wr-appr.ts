export const compContainerPrefix = '/component-container/';
export const compContainer = {
  'container/background/alpha':'50',
  'container/background/bgColor1':'"#ffffff"',
  'container/background/bgColor2':'"#ffffff"',
  'container/background/fillType':'""',
  'container/caption/alignment':'"left"',
  'container/caption/font':'"Arial,13"',
  'container/caption/fontColor':'"#404040"',
  'container/caption/show':'true',
  'container/caption/text':'""',
  'container/header/font':'"Arial,18,bold"',
  'container/header/fontColor':'"#333333"',
  'wrp_cc/fixedHeight':'0',
  'wrp_cc/showEDDExpr':'false',
  'wrp_cc/showHeader':'-1',
  '__##changed_info##__':[]
};

export const textPrefix = '/textComponent/';
export const textAppr = {
  'background/alpha':'50',
  'background/bgColor1':'"#ffffff"',
  'background/bgColor2':'"#ffffff"',
  'background/fillType':'"none"',
  'color':'"#404040"',
  'content/styles':'""',
  'content/text':'""',
  'font':'"Arial,12"',
  'hAlign':'"center"',
  'lineSpacing':'1.3',
  'vAlign':'"middle"',
  '__##changed_info##__':[]
};

export const statPrefix = '/StatsComp/';
export const statAppr = {
  'appr': '""',
  'background/alpha':'50',
  'background/bgColor1':'"#ffffff"',
  'background/bgColor2':'"#ffffff"',
  'background/fillType':'"none"',
  'color':'"#404040"',
  'content/styles':'""',
  'content/text':'""',
  'font':'"Arial,12"',
  'hAlign':'"center"',
  'lineSpacing':'1.3',
  'vAlign':'"middle"',
  '__##changed_info##__':[]
};

export const tablePrefix = '/DataSet/';
export const tableAppr = {
  'header/align':'0',
  'header/background':'"#ededed"',
  'header/font':'"Tahoma,9"',
  'header/fontColor':'"#333333"',
  'header/height':'19',
  'header/show':'true',
  'others/allowFiltering':'0',
  'others/allowRowResize':'false',
  'others/columnWidths':'"{}"',
  'others/contextPanelRelativeHeight':'0.5',
  'others/cursorPos':'"{\\"row\\":-1,\\"col\\":-1}"',
  'others/forcedSingleRowSelectionMode':'false',
  'others/hiddenColumns':'"[]"',
  'others/legendCollapsedItems':'"[]"',
  'others/rowHeight':'-1',
  'others/scrollX':'0',
  'others/scrollY':'0',
  'others/selectRowByCursor':'true',
  'others/showColumnList':'false',
  'others/showContextPanel':'false',
  'others/showFilter':'false',
  'others/showHighlightLegend':'false',
  'others/showLegendFullNames':'true',
  'others/showLegendNodeNames':'true',
  'others/showLegendToolbar':'true',
  'others/showNavBar':'0',
  'others/showRecNoColumn':'true',
  'others/showSearch':'false',
  'others/showToolbar':'false',
  'others/sparklineColumns':'"[]"',
  'others/uniformColumnWidth':'-1',
  'statistics/columnsChartProps':'"{}"',
  'statistics/showToolbar':'false',
  'statistics/sorting':'3',
  'textPanel/font':'"Tahoma,10"',
  'textPanel/fontColor':'"#333333"',
  'textPanel/relativeHeight':'0.2',
  'textPanel/show':'0',
  'textPanel/showParentHighlight':'-1',
  'textPanel/useInitialFormatting':'false',
  '__##changed_info##__':[]
};

export function getPrefix(type: string, subtype: string) {
  if (type == 'static' && subtype == 'text')
    return textPrefix;

  if (type == 'DataSource' && subtype.endsWith('|ds_statistic'))
    return statPrefix;

  if (type == 'DataSource' && subtype.endsWith('|table'))
    return tablePrefix;

  return '';
}

export const apprByPrefix = {
  [textPrefix]: textAppr,
  [statPrefix]: statAppr,
  [tablePrefix]: tableAppr
};
