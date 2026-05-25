import pygwalker as pyg
import pkgutil
print([name for _, name, _ in pkgutil.walk_packages(pyg.__path__)])
