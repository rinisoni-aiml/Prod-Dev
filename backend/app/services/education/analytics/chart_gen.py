import plotly.express as px


def create_chart(data, chart_type):

    if not data:
        return None

    x = list(data[0].keys())[0]
    y = list(data[0].keys())[1]

    if chart_type == "bar":
        fig = px.bar(data, x=x, y=y)

    elif chart_type == "line":
        fig = px.line(data, x=x, y=y)

    elif chart_type == "pie":
        fig = px.pie(data, names=x, values=y)

    return fig.to_json()
