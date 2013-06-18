ko.bindingHandlers.sparkline = {
    update:function (element, valueAccessor, allBindingsAccessor, viewModel) {
        var value = ko.utils.unwrapObservable(valueAccessor());
        var options = allBindingsAccessor().sparklineOptions || {};
        jQuery(element).sparkline(value, options);
    }
};
